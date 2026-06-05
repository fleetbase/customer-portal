import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { alias } from '@ember/object/computed';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency';

const NAMESPACE = 'customer-portal/int/v1';

export default class PortalSettingsAccountComponent extends Component {
    @service currentUser;
    @service customerSession;
    @service fetch;
    @service modalsManager;
    @service notifications;

    @alias('currentUser.user') user;

    @tracked currentPassword;
    @tracked newPassword;
    @tracked newPasswordConfirmation;

    get isContactAccount() {
        return this.customerSession.accountType !== 'vendor';
    }

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

    @action openConvertModal() {
        this.modalsManager.show('modals/portal-convert-to-company', {
            onConverted: () => {
                this.customerSession.promiseCurrentCustomer();
            },
        });
    }

    @task *saveProfile(event) {
        if (event instanceof Event) {
            event.preventDefault();
        }

        let canUpdateProfile = true;
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

    @task *changePassword(event) {
        if (event instanceof Event) {
            event.preventDefault();
        }

        if (this.newPassword !== this.newPasswordConfirmation) {
            this.notifications.error('New password and confirmation do not match.');
            return;
        }

        try {
            yield this.fetch.post(
                'account/change-password',
                {
                    current_password: this.currentPassword,
                    password: this.newPassword,
                    password_confirmation: this.newPasswordConfirmation,
                },
                { namespace: NAMESPACE }
            );

            this.currentPassword = undefined;
            this.newPassword = undefined;
            this.newPasswordConfirmation = undefined;
            this.notifications.success('Password changed successfully.');
        } catch (error) {
            this.notifications.serverError(error, 'Failed to change password.');
        }
    }

    changedUserAttribute(attributeKey) {
        const changedAttributes = this.user.changedAttributes();
        return changedAttributes[attributeKey] !== undefined;
    }
}
