<?php

namespace Fleetbase\CustomerPortal\Services;

use Fleetbase\FleetOps\Models\Contact;
use Fleetbase\FleetOps\Models\Issue;
use Fleetbase\FleetOps\Models\VendorPersonnel;
use Fleetbase\Models\Comment;
use Fleetbase\Models\Company;
use Fleetbase\Models\User;
use Illuminate\Support\Collection;

class PortalSupportService
{
    public function queryForAccount(array $context)
    {
        return Issue::where('company_uuid', session('company'))
            ->where('meta->customer_portal->customer_uuid', $context['account']->uuid)
            ->where('meta->customer_portal->customer_type', $context['account_type']);
    }

    public function portalMeta(array $context, array $extra = []): array
    {
        return array_merge($extra, [
            'customer_portal' => [
                'customer_uuid' => $context['account']->uuid,
                'customer_type' => $context['account_type'],
                'contact_uuid'  => $context['contact']?->uuid,
            ],
        ]);
    }

    public function resolveIssue(string $id, array $context): Issue
    {
        return $this->queryForAccount($context)
            ->where(function ($query) use ($id) {
                $query->where('uuid', $id)
                    ->orWhere('public_id', $id)
                    ->orWhere('issue_id', $id);
            })
            ->firstOrFail();
    }

    public function commentsForIssue(Issue $issue)
    {
        return Comment::where('company_uuid', session('company'))
            ->where('subject_uuid', $issue->uuid)
            ->where('subject_type', Issue::class)
            ->whereNull('parent_comment_uuid')
            ->latest()
            ->get();
    }

    public function resolveComment(Issue $issue, string $id): Comment
    {
        return Comment::where('company_uuid', session('company'))
            ->where('subject_uuid', $issue->uuid)
            ->where('subject_type', Issue::class)
            ->where(function ($query) use ($id) {
                $query->where('uuid', $id)
                    ->orWhere('public_id', $id)
                    ->orWhere('id', $id);
            })
            ->firstOrFail();
    }

    public function createComment(Issue $issue, string $content, ?Comment $parent = null): Comment
    {
        $attributes = [
            'company_uuid'  => session('company'),
            'author_uuid'   => session('user'),
            'content'       => $content,
            'subject_uuid'  => $issue->uuid,
            'subject_type'  => Issue::class,
        ];

        if ($parent) {
            $attributes['parent_comment_uuid'] = $parent->uuid;
        }

        return Comment::publish($attributes);
    }

    public function assertCommentAuthor(Comment $comment): void
    {
        abort_if($comment->author_uuid !== session('user'), 403, 'You can only manage your own comments.');
    }

    public function isCustomerPortalIssue(Issue $issue): bool
    {
        return filled(data_get($issue, 'meta.customer_portal.customer_uuid')) && filled(data_get($issue, 'meta.customer_portal.customer_type'));
    }

    public function customerUserUuidsForIssue(Issue $issue): array
    {
        $customerUuid = data_get($issue, 'meta.customer_portal.customer_uuid');
        $customerType = data_get($issue, 'meta.customer_portal.customer_type');

        if ($customerType === 'vendor') {
            return VendorPersonnel::where('vendor_uuid', $customerUuid)
                ->whereNotIn('status', ['inactive', 'disabled', 'suspended'])
                ->with('contact')
                ->get()
                ->pluck('contact.user_uuid')
                ->filter()
                ->unique()
                ->values()
                ->all();
        }

        $contact = Contact::where('uuid', $customerUuid)->first();

        return $contact?->user_uuid ? [$contact->user_uuid] : [];
    }

    public function operatorUserUuidsForIssue(Issue $issue): array
    {
        return $this->operatorRecipientUserUuidsForIssue($issue, includeReporter: true);
    }

    public function operatorRecipientUserUuidsForIssue(Issue $issue, bool $includeReporter = false): array
    {
        $userUuids = collect([$issue->assigned_to_uuid])->filter();

        if ($includeReporter) {
            $userUuids->push($issue->reported_by_uuid);
            $userUuids = $userUuids->filter();
        }

        if ($userUuids->isEmpty()) {
            $companyOwnerUuid = Company::where('uuid', $issue->company_uuid)->value('owner_uuid');
            $userUuids->push($companyOwnerUuid);
        }

        return $userUuids->filter()->unique()->values()->all();
    }

    public function operatorUsersForIssue(Issue $issue, ?string $excludeUserUuid = null, bool $includeReporter = false): Collection
    {
        $recipients = $this->usersForUuids($this->operatorRecipientUserUuidsForIssue($issue, $includeReporter), $excludeUserUuid);

        if ($recipients->isNotEmpty()) {
            return $recipients;
        }

        $companyOwnerUuid = Company::where('uuid', $issue->company_uuid)->value('owner_uuid');

        return $this->usersForUuids([$companyOwnerUuid], $excludeUserUuid);
    }

    public function customerUsersForIssue(Issue $issue, ?string $excludeUserUuid = null): Collection
    {
        return $this->usersForUuids($this->customerUserUuidsForIssue($issue), $excludeUserUuid);
    }

    public function usersForUuids(array $userUuids, ?string $excludeUserUuid = null): Collection
    {
        return User::whereIn('uuid', collect($userUuids)->filter()->unique()->values()->all())
            ->when($excludeUserUuid, fn ($query) => $query->where('uuid', '!=', $excludeUserUuid))
            ->whereNotNull('email')
            ->get()
            ->unique('email')
            ->values();
    }

    public function migrateCustomerOwnership($contact, $vendor): void
    {
        Issue::where('meta->customer_portal->customer_uuid', $contact->uuid)->get()->each(function (Issue $issue) use ($vendor) {
            $meta = (array) $issue->meta;
            data_set($meta, 'customer_portal.customer_uuid', $vendor->uuid);
            data_set($meta, 'customer_portal.customer_type', 'vendor');
            $issue->update(['meta' => $meta]);
        });
    }
}
