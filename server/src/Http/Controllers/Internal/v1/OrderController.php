<?php

namespace Fleetbase\CustomerPortal\Http\Controllers\Internal\v1;

use Fleetbase\CustomerPortal\Services\PortalAccountResolver;
use Fleetbase\CustomerPortal\Services\PortalConfigService;
use Fleetbase\CustomerPortal\Services\PortalOrderService;
use Fleetbase\FleetOps\Http\Resources\v1\Order as OrderResource;
use Fleetbase\FleetOps\Http\Resources\v1\OrderConfig as OrderConfigResource;
use Fleetbase\FleetOps\Http\Resources\v1\Proof as ProofResource;
use Fleetbase\FleetOps\Http\Resources\v1\TrackingStatus as TrackingStatusResource;
use Fleetbase\FleetOps\Models\Order;
use Fleetbase\FleetOps\Models\OrderConfig;
use Fleetbase\FleetOps\Models\PurchaseRate;
use Fleetbase\FleetOps\Models\ServiceQuote;
use Fleetbase\FleetOps\Support\Utils;
use Fleetbase\Http\Controllers\Controller;
use Fleetbase\Models\Transaction;
use Fleetbase\Models\TransactionItem;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

class OrderController extends Controller
{
    public function __construct(
        protected PortalAccountResolver $accountResolver,
        protected PortalOrderService $orderService,
        protected PortalConfigService $portalConfig,
    ) {
    }

    public function orders(Request $request)
    {
        $context = $this->accountResolver->resolve();
        $query   = $this->orderService->queryForAccount($context);

        if ($request->boolean('completed')) {
            $query->whereIn('status', ['completed', 'done']);
        }

        if ($request->filled('query')) {
            $query->search($request->input('query'));
        }

        $orders = $query->latest()->limit((int) $request->input('limit', 25))->get();

        return response()->json([
            'orders' => OrderResource::collection($orders)->resolve(),
        ]);
    }

    public function order(Request $request, string $id)
    {
        $context = $this->accountResolver->resolve();
        $order   = $this->orderService->resolveOrder($id, $context);
        $request->merge(['with_tracker_data' => true, 'with_eta' => true]);

        return response()->json([
            'order' => $this->orderDetailsResponse($order),
        ]);
    }

    public function createOrder(Request $request)
    {
        $context = $this->accountResolver->resolve();
        $request->validate([
            'type'                       => 'nullable|string',
            'order_config'               => 'nullable',
            'scheduled_at'               => 'nullable|date',
            'notes'                      => 'nullable|string',
            'meta'                       => 'nullable|array',
            'payload'                    => 'nullable',
            'pickup'                     => 'nullable',
            'dropoff'                    => 'nullable',
            'return'                     => 'nullable',
            'waypoints'                  => 'nullable|array',
            'entities'                   => 'nullable|array',
            'entities.*.name'            => 'nullable|string',
            'entities.*.description'     => 'nullable|string',
            'entities.*.weight'          => 'nullable|numeric|min:0',
            'entities.*.weight_unit'     => 'nullable|string',
            'entities.*.length'          => 'nullable|numeric|min:0',
            'entities.*.width'           => 'nullable|numeric|min:0',
            'entities.*.height'          => 'nullable|numeric|min:0',
            'entities.*.dimensions_unit' => 'nullable|string',
            'entities.*.declared_value'  => 'nullable|numeric|min:0',
            'entities.*.currency'        => 'nullable|string|size:3',
            'entities.*.meta'            => 'nullable|array',
            'service_quote'              => 'nullable',
            'service_quote_uuid'         => 'nullable',
            'purchase_rate_uuid'         => 'nullable',
            'pod_required'               => 'nullable|boolean',
            'pod_method'                 => 'nullable|string',
            'files'                      => 'nullable|array',
        ]);

        $enabledOrderConfigIds = $this->portalConfig->enabledOrderConfigIds();
        if (!$request->filled('order_config') && !$request->filled('type') && is_array($enabledOrderConfigIds) && count($enabledOrderConfigIds) > 0) {
            $request->merge(['order_config' => $enabledOrderConfigIds[0]]);
        }

        $orderConfig = $this->orderService->resolveOrderConfig($request);
        $this->abortIfOrderConfigDisabled($orderConfig, $enabledOrderConfigIds);
        abort_if(!$orderConfig, 422, 'No order config available for this company.');

        $payloadUuid = null;
        if (is_array($request->input('payload'))) {
            $payloadUuid = $this->orderService->buildPayloadFromInput((array) $request->input('payload'), $context)->uuid;
        } elseif (is_string($request->input('payload'))) {
            $payloadUuid = Utils::getUuid('payloads', [
                'public_id'    => $request->input('payload'),
                'company_uuid' => session('company'),
            ]);
        } else {
            $payloadInput = $request->only(['pickup', 'dropoff', 'return', 'waypoints', 'entities']);
            if (array_filter($payloadInput, fn ($value) => $value !== null && $value !== '' && $value !== [])) {
                $payloadUuid = $this->orderService->buildPayloadFromInput($payloadInput, $context)->uuid;
            }
        }

        abort_if(!$payloadUuid, 422, 'Pickup and dropoff or at least two waypoints are required.');

        $submittedServiceQuoteId = $request->input('service_quote_uuid', $request->input('service_quote_id'));
        $serviceQuote            = null;
        if ($submittedServiceQuoteId) {
            $serviceQuote = $this->resolvePortalServiceQuote($submittedServiceQuoteId, $context);
            abort_if(!$serviceQuote, 422, 'The selected service quote is no longer available for this customer portal account.');
        }

        $purchaseRate = null;
        if ($request->filled('purchase_rate_uuid')) {
            $purchaseRate = $this->resolvePortalPurchaseRate($request->input('purchase_rate_uuid'), $context);
            abort_if(!$purchaseRate, 422, 'The selected purchase rate is no longer available for this customer portal account.');
        }

        $meta = (array) $request->input('meta', []);
        data_set($meta, 'customer_portal.created_by_uuid', session('user'));
        data_set($meta, 'customer_portal.created_at', now()->toISOString());

        $order = Order::create([
            'company_uuid'       => session('company'),
            'customer_uuid'      => $context['account']->uuid,
            'customer_type'      => Utils::getMutationType($context['account']),
            'payload_uuid'       => $payloadUuid,
            'order_config_uuid'  => $orderConfig->uuid,
            'type'               => $orderConfig->key,
            'status'             => 'created',
            'scheduled_at'       => $request->input('scheduled_at'),
            'notes'              => $request->input('notes'),
            'internal_id'        => $request->input('internal_id'),
            'service_quote_uuid' => $request->input('service_quote_uuid'),
            'pod_required'       => $request->boolean('pod_required'),
            'pod_method'         => $request->input('pod_method'),
            'meta'               => $meta,
        ]);

        if ($purchaseRate instanceof PurchaseRate) {
            $purchaseRate->loadMissing(['serviceQuote.items', 'serviceQuote.serviceRate']);
            $purchaseRate->update([
                'customer_uuid' => $context['account']->uuid,
                'customer_type' => Utils::getMutationType($context['account']),
                'payload_uuid'  => $payloadUuid,
            ]);
            $order->attachPurchaseRate($purchaseRate);
            if ($purchaseRate->transaction_uuid) {
                Transaction::where('uuid', $purchaseRate->transaction_uuid)->update([
                    'customer_uuid' => $context['account']->uuid,
                    'customer_type' => Utils::getMutationType($context['account']),
                    'direction'     => Transaction::DIRECTION_CREDIT,
                ]);
            }
            $this->reconcileOrderFinancials($order->fresh(), $purchaseRate->fresh(['serviceQuote.items', 'serviceQuote.serviceRate']));
        } elseif ($serviceQuote instanceof ServiceQuote) {
            $order->purchaseServiceQuote($serviceQuote);
            $this->reconcileOrderFinancials($order->fresh());
        } else {
            $order->purchaseServiceQuote(null);
        }

        $order = $this->reconcileOrderTransaction($order->fresh());
        $order->attachFiles($request->input('files', []));

        $request->merge(['with_tracker_data' => true, 'with_eta' => true]);

        return response()->json([
            'order' => $this->orderDetailsResponse($order->fresh()),
        ]);
    }

    protected function resolvePortalPurchaseRate($id, array $context): ?PurchaseRate
    {
        if (!$id) {
            return null;
        }

        return PurchaseRate::where('company_uuid', session('company'))
            ->where(function ($query) use ($id) {
                $query->where('uuid', $id)->orWhere('public_id', $id);
            })
            ->where(function ($query) use ($context) {
                $query->whereNull('customer_uuid')->orWhere('customer_uuid', $context['account']->uuid);
            })
            ->whereHas('serviceQuote', function ($query) use ($context) {
                $query->where('meta->customer_portal->account_uuid', $context['account']->uuid)
                    ->where('meta->customer_portal->account_type', Utils::getMutationType($context['account']));
            })
            ->first();
    }

    protected function resolvePortalServiceQuote($id, array $context): ?ServiceQuote
    {
        if (!$id) {
            return null;
        }

        if (is_array($id)) {
            $id = data_get($id, 'uuid', data_get($id, 'public_id', data_get($id, 'id')));
        }

        if (!$id) {
            return null;
        }

        return ServiceQuote::where('company_uuid', session('company'))
            ->where(function ($query) use ($id) {
                $query->where('uuid', $id)->orWhere('public_id', $id);
            })
            ->where('meta->customer_portal->account_uuid', $context['account']->uuid)
            ->where('meta->customer_portal->account_type', Utils::getMutationType($context['account']))
            ->first();
    }

    protected function abortIfOrderConfigDisabled(?OrderConfig $orderConfig, ?array $enabledOrderConfigIds): void
    {
        if (!is_array($enabledOrderConfigIds)) {
            return;
        }

        abort_if(count($enabledOrderConfigIds) === 0, 422, 'Customer portal order creation is disabled.');
        abort_if(
            !$orderConfig || (!in_array($orderConfig->uuid, $enabledOrderConfigIds, true) && !in_array($orderConfig->public_id, $enabledOrderConfigIds, true)),
            422,
            'This order type is not available from the customer portal.'
        );
    }

    protected function reconcileOrderFinancials(Order $order, ?PurchaseRate $purchaseRate = null): void
    {
        $order        = $this->reconcileOrderTransaction($order);
        $purchaseRate = $purchaseRate ?: $order->purchaseRate;

        if ($purchaseRate instanceof PurchaseRate) {
            $purchaseRate->loadMissing(['serviceQuote.items', 'serviceQuote.serviceRate']);
            $this->ensureLedgerInvoiceForPurchaseRate($order, $purchaseRate);
        }
    }

    protected function reconcileOrderTransaction(Order $order): Order
    {
        $order->loadMissing(['purchaseRate']);

        if ($order->purchaseRate instanceof PurchaseRate && !$order->transaction_uuid) {
            $purchaseRate = $order->purchaseRate->fresh(['serviceQuote.items', 'serviceQuote.serviceRate']);
            if (!$purchaseRate->transaction_uuid) {
                $this->createMissingPurchaseRateTransaction($purchaseRate, $order);
                $purchaseRate = $purchaseRate->fresh(['serviceQuote.items', 'serviceQuote.serviceRate']);
            }
            $order->attachPurchaseRate($purchaseRate);
            $order = $order->fresh();
        }

        if (!$order->transaction_uuid && !$order->purchase_rate_uuid) {
            $order->createOrderTransactionWithoutServiceQuote();
            $order = $order->fresh();
        }

        return $order;
    }

    protected function createMissingPurchaseRateTransaction(PurchaseRate $purchaseRate, ?Order $order = null): void
    {
        $purchaseRate->loadMissing(['serviceQuote.items', 'serviceQuote.serviceRate']);
        $order = $order ?: Order::where('payload_uuid', $purchaseRate->payload_uuid)->first();

        $transaction = Transaction::create([
            'company_uuid'           => session('company', $purchaseRate->company_uuid),
            'customer_uuid'          => $purchaseRate->customer_uuid,
            'customer_type'          => $purchaseRate->customer_type,
            'subject_uuid'           => $order?->uuid,
            'subject_type'           => $order ? Order::class : null,
            'context_uuid'           => $purchaseRate->uuid,
            'context_type'           => PurchaseRate::class,
            'gateway_transaction_id' => $purchaseRate->getMeta('transaction_id', Transaction::generateNumber()),
            'gateway'                => 'internal',
            'amount'                 => data_get($purchaseRate, 'serviceQuote.amount', 0),
            'currency'               => data_get($purchaseRate, 'serviceQuote.currency') ?: Utils::getCompanyTransactionCurrency($purchaseRate->company ?? $purchaseRate->company_uuid),
            'description'            => 'Dispatch order',
            'type'                   => 'dispatch',
            'direction'              => Transaction::DIRECTION_CREDIT,
            'status'                 => Transaction::STATUS_SUCCESS,
            'settlement_status'      => Transaction::SETTLEMENT_STATUS_UNPAID,
        ]);

        $purchaseRate->serviceQuote?->items?->each(function ($serviceQuoteItem) use ($transaction) {
            TransactionItem::create([
                'transaction_uuid' => $transaction->uuid,
                'amount'           => $serviceQuoteItem->amount ?? 0,
                'currency'         => $serviceQuoteItem->currency ?? $transaction->currency,
                'details'          => data_get($serviceQuoteItem, 'details', 'Internal dispatch'),
                'code'             => data_get($serviceQuoteItem, 'code', 'internal'),
            ]);
        });

        $purchaseRate->update([
            'transaction_uuid' => $transaction->uuid,
            'status'           => $purchaseRate->status ?: Transaction::STATUS_SUCCESS,
        ]);
    }

    protected function ensureLedgerInvoiceForPurchaseRate(Order $order, PurchaseRate $purchaseRate): void
    {
        if (
            !class_exists(\Fleetbase\Ledger\Models\Invoice::class)
            || !class_exists(\Fleetbase\Ledger\Models\Transaction::class)
            || !class_exists(\Fleetbase\Ledger\Services\InvoiceService::class)
        ) {
            return;
        }

        $checkoutSessionId = $purchaseRate->getMeta('stripe_checkout_session_id');
        $paymentIntentId   = $purchaseRate->getMeta('stripe_payment_intent_id');
        $reference         = $paymentIntentId ?: $checkoutSessionId;

        try {
            $invoice = $this->findLedgerInvoice($order, $purchaseRate);
            if (!$invoice) {
                $invoice = app(\Fleetbase\Ledger\Services\InvoiceService::class)->createFromOrder($order, [
                    'currency'         => data_get($purchaseRate, 'serviceQuote.currency') ?? data_get($order, 'meta.currency') ?? 'USD',
                    'due_date'         => $order->scheduled_at ? Carbon::parse($order->scheduled_at) : now()->addDays(30),
                    'transaction_uuid' => $purchaseRate->transaction_uuid,
                    'notes'            => "Auto-generated from Customer Portal order {$order->public_id}",
                ], $purchaseRate);
            }

            if ($reference) {
                $this->recordLedgerPaymentForPurchaseRate($invoice, $purchaseRate, $reference, $checkoutSessionId, $paymentIntentId);
            } elseif ($invoice->status === 'draft') {
                app(\Fleetbase\Ledger\Services\InvoiceService::class)->send($invoice);
            }
        } catch (\Throwable $e) {
            Log::channel('ledger')->error('[Customer Portal] Failed to sync paid purchase rate with Ledger invoice.', [
                'error'              => $e->getMessage(),
                'order_uuid'         => $order->uuid,
                'purchase_rate_uuid' => $purchaseRate->uuid,
            ]);
        }
    }

    protected function findLedgerInvoice(Order $order, PurchaseRate $purchaseRate): ?\Fleetbase\Ledger\Models\Invoice
    {
        $invoice = \Fleetbase\Ledger\Models\Invoice::where('company_uuid', $order->company_uuid)
            ->where('order_uuid', $order->uuid)
            ->latest()
            ->first();

        if ($invoice || !$purchaseRate->transaction_uuid) {
            return $invoice;
        }

        $invoice = \Fleetbase\Ledger\Models\Invoice::where('company_uuid', $order->company_uuid)
            ->where('transaction_uuid', $purchaseRate->transaction_uuid)
            ->whereNull('order_uuid')
            ->latest()
            ->first();

        if ($invoice) {
            $invoice->update([
                'order_uuid'     => $order->uuid,
                'customer_uuid'  => $order->customer_uuid,
                'customer_type'  => $order->customer_type,
            ]);
        }

        return $invoice;
    }

    protected function recordLedgerPaymentForPurchaseRate($invoice, PurchaseRate $purchaseRate, string $reference, ?string $checkoutSessionId, ?string $paymentIntentId): void
    {
        if ($invoice->status === 'paid' || (int) $invoice->balance <= 0) {
            return;
        }

        $paymentExists = \Fleetbase\Ledger\Models\Transaction::where('company_uuid', $invoice->company_uuid)
            ->where('subject_uuid', $invoice->uuid)
            ->where('subject_type', \Fleetbase\Ledger\Models\Invoice::class)
            ->where('type', 'invoice_payment')
            ->where('reference', $reference)
            ->exists();

        if ($paymentExists) {
            return;
        }

        $paidAmount = (int) ($purchaseRate->getMeta('locked_price') ?: data_get($purchaseRate, 'serviceQuote.amount', 0));
        $balance    = max((int) $invoice->balance, 0);
        $amount     = min($paidAmount, $balance);

        if ($amount <= 0) {
            return;
        }

        app(\Fleetbase\Ledger\Services\InvoiceService::class)->recordPayment($invoice, $amount, [
            'payment_method'             => 'stripe',
            'reference'                  => $reference,
            'stripe_checkout_session_id' => $checkoutSessionId,
            'stripe_payment_intent_id'   => $paymentIntentId,
            'purchase_rate_uuid'         => $purchaseRate->uuid,
        ]);
    }

    public function orderConfigs()
    {
        $enabledOrderConfigs = $this->portalConfig->enabledOrderConfigIds();
        $query               = OrderConfig::where('company_uuid', session('company'));

        if (is_array($enabledOrderConfigs)) {
            $query->where(function ($query) use ($enabledOrderConfigs) {
                $query->whereIn('uuid', $enabledOrderConfigs)->orWhereIn('public_id', $enabledOrderConfigs);
            });
        }

        $orderConfigs = $query->get();

        return response()->json([
            'order_configs' => OrderConfigResource::collection($orderConfigs)->resolve(),
        ]);
    }

    public function orderSummary()
    {
        $context = $this->accountResolver->resolve();
        $query   = $this->orderService->queryForAccount($context);

        return response()->json([
            'active'    => (clone $query)->whereNotIn('status', ['completed', 'done', 'canceled', 'cancelled'])->count(),
            'completed' => (clone $query)->whereIn('status', ['completed', 'done'])->count(),
            'total'     => (clone $query)->count(),
        ]);
    }

    public function cancelOrder(Request $request, string $id)
    {
        $context = $this->accountResolver->resolve();
        $order   = $this->orderService->resolveOrder($id, $context);

        abort_if(in_array($order->status, ['completed', 'done', 'canceled', 'cancelled']), 422, 'This order can no longer be canceled.');

        $order->update(['status' => 'canceled']);
        $request->merge(['with_tracker_data' => true, 'with_eta' => true]);

        return response()->json([
            'order' => $this->orderDetailsResponse($order->fresh()),
        ]);
    }

    public function rescheduleOrder(Request $request, string $id)
    {
        $request->validate(['scheduled_at' => 'required|date']);

        $context = $this->accountResolver->resolve();
        $order   = $this->orderService->resolveOrder($id, $context);

        abort_if(in_array($order->status, ['completed', 'done', 'canceled', 'cancelled']), 422, 'This order can no longer be rescheduled.');

        $order->update(['scheduled_at' => $request->input('scheduled_at')]);
        $request->merge(['with_tracker_data' => true, 'with_eta' => true]);

        return response()->json([
            'order' => $this->orderDetailsResponse($order->fresh()),
        ]);
    }

    public function deleteFile(Request $request, string $id, string $file)
    {
        $context = $this->accountResolver->resolve();
        $order   = $this->orderService->resolveOrder($id, $context);

        $file = $order->files()
            ->where(function ($query) use ($file) {
                $query->where('uuid', $file)->orWhere('public_id', $file);
            })
            ->firstOrFail();

        $file->delete();
        $request->merge(['with_tracker_data' => true, 'with_eta' => true]);

        return response()->json([
            'order' => $this->orderDetailsResponse($order->fresh()),
        ]);
    }

    public function attachFiles(Request $request, string $id)
    {
        $context = $this->accountResolver->resolve();
        $order   = $this->orderService->resolveOrder($id, $context);

        $request->validate([
            'files'   => 'required|array|min:1',
            'files.*' => 'required',
        ]);

        $order->attachFiles($request->input('files', []));
        $request->merge(['with_tracker_data' => true, 'with_eta' => true]);

        return response()->json([
            'order' => $this->orderDetailsResponse($order->fresh()),
        ]);
    }

    protected function loadOrderDetails(Order $order): Order
    {
        return $order->loadMissing([
            'transaction',
            'purchaseRate',
            'purchaseRate.serviceQuote',
            'purchaseRate.serviceQuote.items',
            'purchaseRate.serviceQuote.serviceRate',
            'trackingNumber',
            'trackingStatuses',
            'payload',
            'payload.pickup',
            'payload.dropoff',
            'payload.return',
            'payload.waypoints',
            'payload.entities',
            'files',
            'proofs',
        ]);
    }

    protected function orderDetailsResponse(Order $order): array
    {
        $order = $this->loadOrderDetails($order);

        try {
            $tracker             = $order->tracker();
            $order->tracker_data = $tracker->toArray();
            $order->eta          = $tracker->eta();
        } catch (\Throwable) {
            $order->tracker_data = null;
            $order->eta          = null;
        }

        $data  = (new OrderResource($order))->resolve();

        $data['tracking_statuses'] = TrackingStatusResource::collection($order->trackingStatuses)->resolve();
        $data['transaction']       = $order->transaction ? $order->transaction->toArray() : null;
        $data['proofs']            = ProofResource::collection($order->proofs)->resolve();

        return $data;
    }
}
