<?php

namespace Fleetbase\CustomerPortal\Notifications;

use Fleetbase\FleetOps\Models\Issue;
use Fleetbase\FleetOps\Models\Order;
use Fleetbase\Support\Utils;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;
use Illuminate\Support\Str;

class SupportTicketCreated extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(protected Issue $issue)
    {
    }

    public function via($notifiable): array
    {
        return ['mail'];
    }

    public function toMail($notifiable): MailMessage
    {
        $ticketId = $this->issue->issue_id ?: $this->issue->public_id;
        $customer = $this->issue->reporter?->name ?: $this->issue->reporter?->email ?: 'A customer';
        $priority = Str::headline((string) ($this->issue->priority ?: 'normal'));
        $status   = Str::headline((string) ($this->issue->status ?: 'open'));
        $order    = $this->relatedOrderLabel();

        $message = (new MailMessage())
            ->subject("New customer support ticket {$ticketId}")
            ->greeting('New customer support ticket')
            ->line("{$customer} opened support ticket {$ticketId}.")
            ->line("Priority: {$priority}")
            ->line("Status: {$status}");

        if ($order) {
            $message->line("Related order: {$order}");
        }

        return $message
            ->line(Str::limit(strip_tags((string) $this->issue->report), 240))
            ->action('View Ticket', $this->operatorConsoleUrl());
    }

    protected function relatedOrderLabel(): ?string
    {
        $orderUuid = data_get($this->issue, 'meta.order_uuid');

        if (!$orderUuid) {
            return null;
        }

        $order = Order::where('uuid', $orderUuid)->first();

        return $order?->tracking_number ?? $order?->public_id ?? $orderUuid;
    }

    protected function operatorConsoleUrl(): string
    {
        return Utils::consoleUrl('fleet-ops/management/issues/' . $this->issue->public_id);
    }
}
