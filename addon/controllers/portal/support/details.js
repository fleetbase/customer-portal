import Controller from '@ember/controller';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { capitalize } from '@ember/string';

const NAMESPACE = 'customer-portal/int/v1';

export default class PortalSupportDetailsController extends Controller {
    @service fetch;
    @service notifications;
    @service currentUser;
    @service customerSession;

    @tracked comments = [];

    get issue() {
        return this.model?.issue;
    }

    get issueId() {
        return this.issue?.public_id ?? this.issue?.uuid ?? this.issue?.id;
    }

    get ticketNumber() {
        return this.issue?.issue_id ?? this.issue?.public_id ?? this.issue?.id;
    }

    get title() {
        return this.issue?.title ?? this.ticketNumber ?? 'Support Ticket';
    }

    get reporterName() {
        return this.issue?.reporter?.name ?? this.issue?.reporter_name ?? this.customerSession.get('name') ?? this.currentUser.name ?? 'Customer';
    }

    get reporterEmail() {
        return this.issue?.reporter?.email ?? this.customerSession.get('email') ?? this.currentUser.email;
    }

    get reporterInitials() {
        const name = this.reporterName || 'Customer';
        const words = name.split(/\s+/).filter(Boolean);
        const initials = words
            .slice(0, 2)
            .map((word) => word.charAt(0))
            .join('');

        return initials.toUpperCase() || 'C';
    }

    get statusLabel() {
        return this.label(this.issue?.status ?? 'open');
    }

    get priorityLabel() {
        return this.label(this.issue?.priority ?? 'normal');
    }

    get relatedOrder() {
        return this.issue?.order ?? this.issue?.meta?.order ?? this.issue?.meta?.order_uuid ?? this.issue?.meta?.customer_portal?.order_uuid;
    }

    get hasRelatedOrderDetails() {
        return typeof this.relatedOrder === 'object' && this.relatedOrder !== null;
    }

    get relatedOrderId() {
        const order = this.relatedOrder;

        if (!order || typeof order === 'string') {
            return order;
        }

        return order.public_id ?? order.id ?? order.uuid;
    }

    get relatedOrderLabel() {
        const order = this.relatedOrder;

        if (!order) {
            return null;
        }

        if (typeof order === 'string') {
            return order;
        }

        return order.tracking_number?.tracking_number ?? order.tracking ?? order.public_id ?? order.id ?? order.uuid;
    }

    get issueAttachments() {
        const attachments = this.issue?.files ?? this.issue?.attachments ?? this.issue?.meta?.attachments ?? [];

        return Array.isArray(attachments) ? attachments.filter(Boolean) : [];
    }

    get hasIssueAttachments() {
        return this.issueAttachments.length > 0;
    }

    get issueTags() {
        const tags = this.issue?.tags ?? [];

        return Array.isArray(tags) ? tags.filter(Boolean) : [];
    }

    get hasIssueTags() {
        return this.issueTags.length > 0;
    }

    get hasComments() {
        return this.comments.length > 0;
    }

    label(value) {
        return `${value ?? ''}`
            .split(/[_-]/)
            .filter(Boolean)
            .map((word) => capitalize(word))
            .join(' ');
    }

    identifier(comment) {
        return comment?.public_id ?? comment?.uuid ?? comment?.id;
    }

    @action async reloadComments() {
        if (!this.issueId) {
            return [];
        }

        const response = await this.fetch.get(`issues/${this.issueId}/comments`, {}, { namespace: NAMESPACE });
        this.comments = response.comments ?? [];

        return this.comments;
    }

    @action async publishComment(content) {
        await this.fetch.post(`issues/${this.issueId}/comments`, { content }, { namespace: NAMESPACE });
        this.notifications.success('Reply posted.');
    }

    @action async publishReply(comment, content) {
        const commentId = this.identifier(comment);

        await this.fetch.post(`issues/${this.issueId}/comments/${commentId}/replies`, { content }, { namespace: NAMESPACE });
        this.notifications.success('Reply posted.');
    }

    @action async updateComment(comment) {
        const commentId = this.identifier(comment);

        await this.fetch.patch(`issues/${this.issueId}/comments/${commentId}`, { content: comment.content }, { namespace: NAMESPACE });
        this.notifications.success('Comment updated.');
    }

    @action async deleteComment(comment) {
        const commentId = this.identifier(comment);

        await this.fetch.delete(`issues/${this.issueId}/comments/${commentId}`, {}, { namespace: NAMESPACE });
        this.notifications.success('Comment deleted.');
    }

    @action downloadFile(file) {
        const url = file?.url ?? file?.download_url ?? file?.path;

        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }
}
