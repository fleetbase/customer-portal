import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { debug } from '@ember/debug';
import { task } from 'ember-concurrency';

export default class PortalOrderFormDocumentsComponent extends Component {
    @service fetch;
    @service notifications;
    @service customerPortalOrderCreation;

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

    get files() {
        return this.args.draft?.files ?? [];
    }

    @task *queueFile(file) {
        if (!['queued', 'failed', 'timed_out', 'aborted'].includes(file.state)) {
            return;
        }

        try {
            this.uploadQueue = [...this.uploadQueue, file];

            yield this.fetch.uploadFile.perform(
                file,
                {
                    path: 'uploads/customer-portal/order-files',
                    type: 'order_file',
                },
                (uploadedFile) => {
                    this.customerPortalOrderCreation.setField('files', [...this.files, uploadedFile]);
                    this.uploadQueue = this.uploadQueue.filter((queuedFile) => queuedFile !== file);
                },
                () => {
                    this.uploadQueue = this.uploadQueue.filter((queuedFile) => queuedFile !== file);
                    if (file.queue && typeof file.queue.remove === 'function') {
                        file.queue.remove(file);
                    }
                }
            );
        } catch (error) {
            debug(`Customer portal order document upload failed: ${error.message}`);
            this.notifications.serverError(error);
        }
    }

    @task *removeFile(file) {
        this.customerPortalOrderCreation.setField(
            'files',
            this.files.filter((candidate) => candidate !== file)
        );

        if (typeof file?.destroyRecord === 'function') {
            yield file.destroyRecord();
        }
    }
}
