import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { valueFor } from '../../utils/model-access';

export default class PortalDocumentsController extends Controller {
    @service notifications;

    @action async downloadDocument(document) {
        if (typeof document?.download === 'function') {
            try {
                await document.download();
                return;
            } catch (error) {
                this.notifications.serverError(error);
                return;
            }
        }

        const url = valueFor(document, 'url');
        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
            return;
        }

        this.notifications.info('This file is not available for download yet.');
    }
}
