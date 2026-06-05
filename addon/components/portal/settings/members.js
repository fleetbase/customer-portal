import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { task } from 'ember-concurrency';

export default class PortalSettingsMembersComponent extends Component {
    @service customerSession;
    @service fetch;
    @service modalsManager;
    @service notifications;

    @tracked personnels = [];
    @tracked personnelCandidates = [];
    @tracked selectedContact;
    @tracked personnelMode = 'existing';
    @tracked personnelName;
    @tracked personnelEmail;
    @tracked personnelPhone;
    @tracked personnelRole = 'member';
    @tracked createLogin = true;

    roleOptions = [
        { label: 'Admin', value: 'admin', description: 'Can manage account settings and personnel.' },
        { label: 'Member', value: 'member', description: 'Can access the customer workspace.' },
    ];

    constructor() {
        super(...arguments);

        if (this.isCompanyAccount) {
            this.loadPersonnel.perform();
        }
    }

    get isCompanyAccount() {
        return this.customerSession.accountType === 'vendor';
    }

    get selectedRole() {
        return this.roleOptions.find((option) => option.value === this.personnelRole);
    }

    get isAddingExistingContact() {
        return this.personnelMode === 'existing';
    }

    get isCreatingContact() {
        return this.personnelMode === 'new';
    }

    get hasPersonnel() {
        return this.personnels.length > 0;
    }

    get memberContactIds() {
        return new Set(this.personnels.flatMap((personnel) => [personnel.contact_uuid, personnel.uuid, personnel.public_id, personnel.id]).filter(Boolean));
    }

    get availablePersonnelCandidates() {
        const memberContactIds = this.memberContactIds;

        return this.personnelCandidates.filter((contact) => {
            const ids = [contact.uuid, contact.public_id, contact.id].filter(Boolean);

            return !ids.some((id) => memberContactIds.has(id));
        });
    }

    get selectedContactIsAlreadyMember() {
        if (!this.selectedContact) {
            return false;
        }

        const ids = [this.selectedContact.uuid, this.selectedContact.public_id, this.selectedContact.id].filter(Boolean);

        return ids.some((id) => this.memberContactIds.has(id));
    }

    get canAddPersonnel() {
        if (this.isAddingExistingContact) {
            return this.selectedContact && !this.selectedContactIsAlreadyMember;
        }

        return this.personnelName && this.personnelEmail;
    }

    @action openConvertModal() {
        this.modalsManager.show('modals/portal-convert-to-company', {
            onConverted: () => {
                this.customerSession.promiseCurrentCustomer().then(() => {
                    this.loadPersonnel.perform();
                });
            },
        });
    }

    @action setPersonnelMode(mode) {
        this.personnelMode = mode;
        this.clearPersonnelForm();
    }

    @action selectContact(contact) {
        this.selectedContact = contact;
    }

    @action selectRole(role) {
        this.personnelRole = role?.value ?? 'member';
    }

    @action toggleCreateLogin(value) {
        this.createLogin = value;
    }

    clearPersonnelForm() {
        this.selectedContact = null;
        this.personnelName = '';
        this.personnelEmail = '';
        this.personnelPhone = '';
        this.personnelRole = 'member';
        this.createLogin = true;
    }

    @task *loadPersonnel() {
        try {
            const [personnelResponse, candidateResponse] = yield Promise.all([
                this.fetch.get('account/personnels', {}, { namespace: 'customer-portal/int/v1' }),
                this.fetch.get('account/personnel-candidates', {}, { namespace: 'customer-portal/int/v1' }),
            ]);

            this.personnels = personnelResponse.personnels ?? [];
            this.personnelCandidates = candidateResponse.contacts ?? [];

            if (this.selectedContactIsAlreadyMember) {
                this.selectedContact = null;
            }
        } catch (error) {
            this.personnels = [];
            this.personnelCandidates = [];
            this.notifications.serverError(error);
        }
    }

    @task *addPersonnel(event) {
        if (event instanceof Event) {
            event.preventDefault();
        }

        if (!this.canAddPersonnel) {
            this.notifications.warning(this.isAddingExistingContact ? 'Select a contact that is not already a member.' : 'Name and email are required.');
            return;
        }

        const payload = {
            role: this.personnelRole,
            create_login: this.createLogin,
        };

        if (this.isAddingExistingContact) {
            payload.contact = this.selectedContact?.public_id ?? this.selectedContact?.uuid ?? this.selectedContact?.id;
        } else {
            payload.name = this.personnelName;
            payload.email = this.personnelEmail;
            payload.phone = this.personnelPhone;
        }

        try {
            const response = yield this.fetch.post('account/personnels', payload, { namespace: 'customer-portal/int/v1' });
            const personnel = response.personnel;

            if (personnel) {
                this.personnels = [...this.personnels.filter((item) => item.contact_uuid !== personnel.contact_uuid), personnel];
                this.personnelCandidates = this.personnelCandidates.filter(
                    (contact) => contact.uuid !== personnel.contact_uuid && contact.public_id !== personnel.id && contact.id !== personnel.id
                );
            }

            this.clearPersonnelForm();
            this.notifications.success('Personnel added.');
        } catch (error) {
            this.notifications.serverError(error);
        }
    }

    @task *removePersonnel(personnel) {
        try {
            yield this.fetch.delete(`account/personnels/${personnel.id}`, {}, { namespace: 'customer-portal/int/v1' });
            this.personnels = this.personnels.filter((item) => item.id !== personnel.id);
            yield this.loadPersonnel.perform();
            this.notifications.success('Personnel removed.');
        } catch (error) {
            this.notifications.serverError(error);
        }
    }
}
