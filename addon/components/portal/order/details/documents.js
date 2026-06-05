import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { debug } from '@ember/debug';
import { task } from 'ember-concurrency';
import { arrayFor, identifierFor, valueFor } from '../../../../utils/model-access';

const ORDER_NORMALIZE_OPTIONS = {
    namespace: 'customer-portal/int/v1',
    normalizeToEmberData: true,
    normalizeModelType: 'order',
};

export default class PortalOrderDetailsDocumentsComponent extends Component {
    @service customerPortalOrderActions;
    @service fetch;
    @service modalsManager;
    @service notifications;

    @tracked files = [];
    @tracked uploadQueue = [];

    acceptedFileTypes = [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/msword',
        'application/pdf',
        'application/x-pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/quicktime',
        'video/x-msvideo',
        'video/x-flv',
        'video/x-ms-wmv',
        'audio/mpeg',
        'application/zip',
        'application/x-tar',
    ];

    constructor() {
        super(...arguments);

        this.files = arrayFor(valueFor(this.args.resource, 'files'));
    }

    downloadFile = async (file) => {
        if (typeof file?.download === 'function') {
            try {
                await file.download();
                return;
            } catch (error) {
                this.notifications.serverError(error);
                return;
            }
        }

        const url = valueFor(file, 'url');
        const permalink = valueFor(file, 'permalink');

        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
            return;
        }

        if (permalink) {
            window.open(permalink, '_blank', 'noopener,noreferrer');
            return;
        }

        this.notifications.info('This file is not available for download yet.');
    };

    syncOrder(order) {
        const files = arrayFor(valueFor(order, 'files'));

        if (!files.length) {
            return;
        }

        this.files = files;
    }

    @task *queueFile(file) {
        if (!['queued', 'failed', 'timed_out', 'aborted'].includes(file.state)) {
            return;
        }

        try {
            this.uploadQueue = [...this.uploadQueue, file];

            const uploadedFile = yield this.fetch.uploadFile.perform(
                file,
                {
                    path: 'uploads/customer-portal/order-files',
                    type: 'order_file',
                },
                null,
                () => {
                    this.uploadQueue = this.uploadQueue.filter((queuedFile) => queuedFile !== file);
                    if (file.queue && typeof file.queue.remove === 'function') {
                        file.queue.remove(file);
                    }
                }
            );

            const orderId = this.customerPortalOrderActions.identifier(this.args.resource);
            const fileId = identifierFor(uploadedFile);

            if (!fileId) {
                this.uploadQueue = this.uploadQueue.filter((queuedFile) => queuedFile !== file);
                this.notifications.warning('Unable to attach this file to the order.');
                return;
            }

            const order = yield this.fetch.post(`orders/${orderId}/files`, { files: [fileId] }, ORDER_NORMALIZE_OPTIONS);

            this.syncOrder(order);
            this.uploadQueue = this.uploadQueue.filter((queuedFile) => queuedFile !== file);
            this.notifications.success('File attached.');
        } catch (error) {
            debug(`Customer portal order document upload failed: ${error.message}`);
            this.uploadQueue = this.uploadQueue.filter((queuedFile) => queuedFile !== file);
            this.notifications.serverError(error);
        }
    }

    @task *deleteFile(file) {
        yield this.modalsManager.confirm({
            title: 'Delete file?',
            body: 'This removes the file from this order.',
            acceptButtonText: 'Delete',
            acceptButtonType: 'danger',
            confirm: async () => {
                try {
                    const orderId = this.customerPortalOrderActions.identifier(this.args.resource);
                    const fileId = identifierFor(file);

                    if (!fileId) {
                        this.notifications.warning('Unable to identify this file.');
                        return;
                    }

                    const order = await this.fetch.delete(`orders/${orderId}/files/${fileId}`, {}, ORDER_NORMALIZE_OPTIONS);

                    this.files = arrayFor(valueFor(order, 'files'));
                    this.notifications.success('File removed.');
                } catch (error) {
                    this.notifications.serverError(error);
                }
            },
        });
    }
}
