import Controller from '@ember/controller';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { tracked } from '@glimmer/tracking';
import { task } from 'ember-concurrency';
import { issueCategories, issuePriorities } from '@fleetbase/fleetops-engine/utils/fleet-ops-options';

export default class PortalSupportNewController extends Controller {
    @service fetch;
    @service notifications;
    @service hostRouter;

    queryParams = ['order_id'];

    @tracked title;
    @tracked report;
    @tracked order;
    @tracked order_id;
    @tracked type = 'customer';
    @tracked category;
    @tracked priority = 'medium';
    @tracked tags = [];

    issuePriorities = issuePriorities;
    customerIssueCategories = issueCategories.filter((category) => category.group === 'customer');

    get selectedIssueCategory() {
        return this.customerIssueCategories.find((category) => category.value === this.category);
    }

    get selectedIssuePriority() {
        return this.issuePriorities.find((priority) => priority.value === this.priority);
    }

    preselectOrder(orderId) {
        this.order_id = orderId;

        if (!orderId) {
            this.order = null;
            return;
        }

        this.order = this.model?.orders?.find((order) => [order?.uuid, order?.public_id, order?.id].includes(orderId));
    }

    @task *createTicket(event) {
        if (event instanceof Event) {
            event.preventDefault();
        }

        try {
            yield this.fetch.post(
                'issues',
                {
                    title: this.title,
                    report: this.report,
                    type: this.type,
                    category: this.category,
                    priority: this.priority,
                    order: this.order,
                    tags: this.tags,
                },
                { namespace: 'customer-portal/int/v1' }
            );

            this.resetForm();
            this.notifications.success('Support ticket created.');
            this.hostRouter.transitionTo('customer-portal.portal.support.index');
        } catch (error) {
            this.notifications.serverError(error);
        }
    }

    resetForm() {
        this.title = '';
        this.report = '';
        this.order = null;
        this.order_id = null;
        this.type = 'customer';
        this.category = null;
        this.priority = 'medium';
        this.tags = [];
    }

    @action setIssueCategory(category) {
        this.category = category?.value;
    }

    @action setIssuePriority(priority) {
        this.priority = priority?.value ?? 'medium';
    }

    @action addTag(tag) {
        this.tags = [...this.tags, tag];
    }

    @action removeTag(index) {
        this.tags = this.tags.filter((_, tagIndex) => tagIndex !== index);
    }
}
