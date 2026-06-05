<?php

namespace Fleetbase\CustomerPortal\Http\Controllers\Internal\v1;

use Fleetbase\CustomerPortal\Services\PortalAccountResolver;
use Fleetbase\CustomerPortal\Services\PortalOrderService;
use Fleetbase\CustomerPortal\Services\PortalSupportService;
use Fleetbase\FleetOps\Http\Resources\v1\Issue as IssueResource;
use Fleetbase\FleetOps\Http\Resources\v1\Order as OrderResource;
use Fleetbase\FleetOps\Models\Issue;
use Fleetbase\Http\Controllers\Controller;
use Fleetbase\Http\Resources\Comment as CommentResource;
use Fleetbase\LaravelMysqlSpatial\Types\Point;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SupportController extends Controller
{
    protected array $issuePriorities = [
        'low',
        'medium',
        'high',
        'critical',
        'scheduled_maintenance',
        'operational_suggestion',
    ];

    protected array $customerIssueCategories = [
        'customer_complaint',
        'service_quality',
        'billing_discrepancies',
        'customer_communication',
        'order_errors',
    ];

    public function __construct(
        protected PortalAccountResolver $accountResolver,
        protected PortalOrderService $orderService,
        protected PortalSupportService $supportService,
    ) {
    }

    public function issues()
    {
        $context = $this->accountResolver->resolve();
        $issues  = $this->supportService->queryForAccount($context)->latest()->limit(50)->get();

        return response()->json([
            'issues' => IssueResource::collection($issues)->resolve(),
        ]);
    }

    public function issue(string $id)
    {
        $context  = $this->accountResolver->resolve();
        $issue    = $this->supportService->resolveIssue($id, $context);
        $comments = $this->supportService->commentsForIssue($issue);
        $resource = (new IssueResource($issue))->resolve();
        $orderId  = data_get($resource, 'meta.order_uuid');

        if ($orderId) {
            try {
                $order             = $this->orderService->resolveOrder($orderId, $context);
                $resource['order'] = (new OrderResource($order))->resolve();
            } catch (\Throwable $e) {
                $resource['order'] = null;
            }
        }

        return response()->json([
            'issue'    => $resource,
            'comments' => CommentResource::collection($comments)->resolve(),
        ]);
    }

    public function comments(string $id)
    {
        $context  = $this->accountResolver->resolve();
        $issue    = $this->supportService->resolveIssue($id, $context);
        $comments = $this->supportService->commentsForIssue($issue);

        return response()->json([
            'comments' => CommentResource::collection($comments)->resolve(),
        ]);
    }

    public function createComment(Request $request, string $id)
    {
        $context = $this->accountResolver->resolve();
        $issue   = $this->supportService->resolveIssue($id, $context);

        $request->validate([
            'content' => 'required|string|min:2',
        ]);

        $comment = $this->supportService->createComment($issue, $request->input('content'));

        return response()->json([
            'comment' => (new CommentResource($comment))->resolve(),
        ]);
    }

    public function createReply(Request $request, string $id, string $comment)
    {
        $context = $this->accountResolver->resolve();
        $issue   = $this->supportService->resolveIssue($id, $context);
        $parent  = $this->supportService->resolveComment($issue, $comment);

        $request->validate([
            'content' => 'required|string|min:2',
        ]);

        $reply = $this->supportService->createComment($issue, $request->input('content'), $parent);

        return response()->json([
            'comment' => (new CommentResource($reply))->resolve(),
        ]);
    }

    public function updateComment(Request $request, string $id, string $comment)
    {
        $context = $this->accountResolver->resolve();
        $issue   = $this->supportService->resolveIssue($id, $context);
        $comment = $this->supportService->resolveComment($issue, $comment);

        $this->supportService->assertCommentAuthor($comment);

        $request->validate([
            'content' => 'required|string|min:2',
        ]);

        $comment->update(['content' => $request->input('content')]);

        return response()->json([
            'comment' => (new CommentResource($comment->fresh()))->resolve(),
        ]);
    }

    public function deleteComment(string $id, string $comment)
    {
        $context = $this->accountResolver->resolve();
        $issue   = $this->supportService->resolveIssue($id, $context);
        $comment = $this->supportService->resolveComment($issue, $comment);

        $this->supportService->assertCommentAuthor($comment);
        $comment->delete();

        return response()->json(['deleted' => true]);
    }

    public function createIssue(Request $request)
    {
        $context = $this->accountResolver->resolve();
        $request->validate([
            'title'    => 'required|string|max:191',
            'report'   => 'required|string',
            'priority' => ['nullable', 'string', Rule::in($this->issuePriorities)],
            'category' => ['nullable', 'string', Rule::in($this->customerIssueCategories)],
            'order'    => 'nullable',
            'tags'     => 'nullable|array',
            'tags.*'   => 'string|max:80',
        ]);

        $issue = Issue::create([
            'company_uuid'     => session('company'),
            'reported_by_uuid' => session('user'),
            'title'            => $request->input('title'),
            'report'           => $request->input('report'),
            'priority'         => $request->input('priority', 'medium'),
            'tags'             => $request->input('tags', []),
            'type'             => 'customer',
            'category'         => $request->input('category'),
            'status'           => 'open',
            'location'         => new Point(0, 0),
            'meta'             => $this->supportService->portalMeta($context, [
                'order_uuid' => $this->orderService->resolveOrderUuid($request->input('order'), $context),
            ]),
        ]);

        return response()->json([
            'issue' => (new IssueResource($issue))->resolve(),
        ]);
    }

    public function summary()
    {
        $context = $this->accountResolver->resolve();
        $query   = $this->supportService->queryForAccount($context);

        return response()->json([
            'open'  => (clone $query)->whereNotIn('status', ['resolved', 'closed'])->count(),
            'total' => (clone $query)->count(),
        ]);
    }
}
