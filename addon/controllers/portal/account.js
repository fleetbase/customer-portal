import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { alias } from '@ember/object/computed';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency';

export default class PortalAccountController extends Controller {
    /**
     * Inject the `currentUser` service.
     *
     * @memberof ConsoleAccountIndexController
     */
    @service currentUser;

    /**
     * Inject the `fetch` service.
     *
     * @memberof ConsoleAccountIndexController
     */
    @service fetch;

    /**
     * Inject the `notifications` service.
     *
     * @memberof ConsoleAccountIndexController
     */
    @service notifications;

    /**
     * Inject the `modalsManager` service.
     *
     * @memberof ConsoleAccountIndexController
     */
    @service modalsManager;

    @service customerSession;

    @tracked personnels = [];
    @tracked personnelCandidates = [];
    @tracked selectedContact;
    @tracked personnelMode = 'existing';
    @tracked personnelName;
    @tracked personnelEmail;
    @tracked personnelPhone;
    @tracked personnelRole = 'member';
    @tracked createLogin = true;
    @tracked companyName;
    @tracked companyEmail;
    @tracked companyPhone;

    roleOptions = [
        { label: 'Admin', value: 'admin', description: 'Can manage account settings and personnel.' },
        { label: 'Member', value: 'member', description: 'Can access the customer workspace.' },
    ];

    /**
     * Alias to the currentUser service user record.
     *
     * @memberof ConsoleAccountIndexController
     */
    @alias('currentUser.user') user;

    get account() {
        return this.customerSession.account ?? {};
    }

    get isCompanyAccount() {
        return this.customerSession.accountType === 'vendor';
    }

    get isContactAccount() {
        return !this.isCompanyAccount;
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

    get canAddPersonnel() {
        if (this.isAddingExistingContact) {
            return this.selectedContact;
        }

        return this.personnelName && this.personnelEmail;
    }

    get canConvertAccount() {
        return this.companyName || this.customerSession.get('name');
    }

    get accountName() {
        return this.customerSession.get('name');
    }

    get accountEmail() {
        return this.customerSession.get('email');
    }

    @action setupAccountDefaults() {
        if (!this.companyName) {
            this.companyName = this.customerSession.get('name');
            this.companyEmail = this.customerSession.get('email');
            this.companyPhone = this.customerSession.get('phone');
        }

        if (this.isCompanyAccount && this.loadPersonnel.isIdle && this.personnels.length === 0) {
            this.loadPersonnel.perform();
        }
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

    /**
     * Handle upload of new photo
     *
     * @param {UploadFile} file
     * @memberof ConsoleAccountIndexController
     */
    @action uploadNewPhoto(file) {
        return this.fetch.uploadFile.perform(
            file,
            {
                path: `uploads/${this.user.company_uuid}/users/${this.user.slug}`,
                subject_uuid: this.user.id,
                subject_type: 'user',
                type: 'user_avatar',
            },
            (uploadedFile) => {
                this.user.setProperties({
                    avatar_uuid: uploadedFile.id,
                    avatar_url: uploadedFile.url,
                });

                return this.user.save();
            }
        );
    }

    clearPersonnelForm() {
        this.selectedContact = null;
        this.personnelName = '';
        this.personnelEmail = '';
        this.personnelPhone = '';
        this.personnelRole = 'member';
        this.createLogin = true;
    }

    @task *convertToCompanyAccount(event) {
        if (event instanceof Event) {
            event.preventDefault();
        }

        try {
            yield this.fetch.post(
                'account/convert-to-vendor',
                {
                    name: this.companyName || this.customerSession.get('name'),
                    email: this.companyEmail || this.customerSession.get('email'),
                    phone: this.companyPhone || this.customerSession.get('phone'),
                },
                { namespace: 'customer-portal/int/v1' }
            );

            yield this.customerSession.promiseCurrentCustomer();
            this.notifications.success('Company account created.');
            this.loadPersonnel.perform();
        } catch (error) {
            this.notifications.serverError(error);
        }
    }

    @task *loadPersonnel() {
        try {
            const [personnelResponse, candidateResponse] = yield Promise.all([
                this.fetch.get('account/personnels', {}, { namespace: 'customer-portal/int/v1' }),
                this.fetch.get('account/personnel-candidates', {}, { namespace: 'customer-portal/int/v1' }),
            ]);

            this.personnels = personnelResponse.personnels ?? [];
            this.personnelCandidates = candidateResponse.contacts ?? [];
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
            this.notifications.warning(this.isAddingExistingContact ? 'Select a contact to add.' : 'Name and email are required.');
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
            this.notifications.success('Personnel removed.');
        } catch (error) {
            this.notifications.serverError(error);
        }
    }

    /**
     * Starts the task to change password
     *
     * @param {Event} event
     * @memberof ConsoleAccountIndexController
     */
    @task *saveProfile(event) {
        // If from event fired
        if (event instanceof Event) {
            event.preventDefault();
        }

        let canUpdateProfile = true;
        // If email has been changed prompt for password validation
        if (this.changedUserAttribute('email')) {
            canUpdateProfile = yield this.validatePassword.perform();
        }

        if (canUpdateProfile === true) {
            try {
                const user = yield this.user.save();
                this.notifications.success('Profile changes saved.');
                this.currentUser.set('user', user);
            } catch (error) {
                this.notifications.serverError(error);
            }
        } else {
            this.user.rollbackAttributes();
        }
    }

    /**
     * Task to validate current password
     *
     * @return {boolean}
     * @memberof ConsoleAccountIndexController
     */
    @task *validatePassword() {
        let isPasswordValid = false;

        yield this.modalsManager.show('modals/validate-password', {
            body: 'You must validate your password to update the account email address.',
            onValidated: (isValid) => {
                isPasswordValid = isValid;
            },
        });

        return isPasswordValid;
    }

    /**
     * Checks if any user attribute has been changed
     *
     * @param {string} attributeKey
     * @return {boolean}
     * @memberof ConsoleAccountIndexController
     */
    changedUserAttribute(attributeKey) {
        const changedAttributes = this.user.changedAttributes();
        return changedAttributes[attributeKey] !== undefined;
    }
}
