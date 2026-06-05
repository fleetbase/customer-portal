<?php

namespace Fleetbase\CustomerPortal\Observers;

use Fleetbase\CustomerPortal\Notifications\IssueCommentCreated;
use Fleetbase\CustomerPortal\Services\PortalSupportService;
use Fleetbase\FleetOps\Models\Issue;
use Fleetbase\Models\Comment;
use Illuminate\Support\Facades\Notification;

class CommentObserver
{
    public function created(Comment $comment): void
    {
        if ($comment->subject_type !== Issue::class || !$comment->subject_uuid) {
            return;
        }

        $issue = Issue::where('uuid', $comment->subject_uuid)->first();

        if (!$issue) {
            return;
        }

        /** @var PortalSupportService $supportService */
        $supportService = app(PortalSupportService::class);

        if (!$supportService->isCustomerPortalIssue($issue)) {
            return;
        }

        $customerUserUuids = $supportService->customerUserUuidsForIssue($issue);
        $authorUuid        = $comment->author_uuid;
        $authorIsCustomer  = in_array($authorUuid, $customerUserUuids, true);
        $audience          = $authorIsCustomer ? 'operator' : 'customer';
        $recipients        = $authorIsCustomer
            ? $supportService->operatorUsersForIssue($issue, $authorUuid, includeReporter: true)
            : $supportService->customerUsersForIssue($issue, $authorUuid);

        if ($recipients->isEmpty()) {
            return;
        }

        Notification::send($recipients, new IssueCommentCreated($issue, $comment->loadMissing('author'), $audience));
    }
}
