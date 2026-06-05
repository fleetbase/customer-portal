<?php

namespace Fleetbase\CustomerPortal\Notifications;

use Fleetbase\FleetOps\Models\Issue;
use Fleetbase\Models\Comment;
use Fleetbase\Models\Setting;
use Fleetbase\Support\Utils;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

class IssueCommentCreated extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        protected Issue $issue,
        protected Comment $comment,
        protected string $audience,
    ) {
    }

    public function via($notifiable): array
    {
        return ['mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        $ticketId = $this->issue->issue_id ?: $this->issue->public_id;
        $author   = $this->comment->author?->name ?: $this->comment->author?->email ?: 'A user';
        $subject  = "New reply on support ticket {$ticketId}";
        $url      = $this->audience === 'customer' ? $this->customerPortalUrl() : $this->operatorConsoleUrl();

        return (new MailMessage())
            ->subject($subject)
            ->greeting('New support reply')
            ->line("{$author} replied to support ticket {$ticketId}.")
            ->line(Str::limit(strip_tags((string) $this->comment->content), 240))
            ->action('View Ticket', $url);
    }

    protected function customerPortalUrl(): string
    {
        $customerPortalConfig = Setting::lookupFromCompany('customer-portal-config', []);
        $accessUrlSlug        = data_get($customerPortalConfig, 'accessUrlSlug', 'customer-portal');

        return Utils::consoleUrl(trim($accessUrlSlug, '/') . '/support/' . $this->issue->public_id);
    }

    protected function operatorConsoleUrl(): string
    {
        return Utils::consoleUrl('fleet-ops/management/issues/' . $this->issue->public_id);
    }
}
