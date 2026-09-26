<?php

use Fleetbase\CustomerPortal\Notifications\IssueCommentCreated;
use Fleetbase\FleetOps\Models\Issue;
use Fleetbase\Models\Comment;
use Illuminate\Database\ConnectionResolver;
use Illuminate\Database\Eloquent\Model as EloquentModel;
use Illuminate\Database\SQLiteConnection;

if (!function_exists('Fleetbase\Models\config')) {
    eval('namespace Fleetbase\Models; function config($key = null, $default = null) { return $key === "fleetbase.connection.db" ? "mysql" : $default; }');
}

if (!function_exists('Fleetbase\Support\config')) {
    eval('namespace Fleetbase\Support; function config($key = null, $default = null) { return ["fleetbase.console.host" => "console.fleetbase.test", "fleetbase.console.secure" => true][$key] ?? $default; } function app() { return new class { public function environment($environments = null) { return false; } }; }');
}

if (!function_exists('session')) {
    function session($key = null, $default = null)
    {
        static $values = [];

        if (is_array($key)) {
            $values = array_merge($values, $key);

            return null;
        }

        return $key === null ? $values : ($values[$key] ?? $default);
    }
}

function customerPortalIssueCommentBoot(): SQLiteConnection
{
    $connection = new SQLiteConnection(new PDO('sqlite::memory:'));
    $resolver   = new ConnectionResolver(['default' => $connection, 'mysql' => $connection]);
    $resolver->setDefaultConnection('mysql');
    EloquentModel::setConnectionResolver($resolver);

    $connection->getSchemaBuilder()->create('settings', function ($blueprint) {
        $blueprint->increments('id');
        $blueprint->string('key')->nullable();
        $blueprint->text('value')->nullable();
        $blueprint->timestamps();
    });

    return $connection;
}

function customerPortalIssueCommentNotification(string $companyUuid): IssueCommentCreated
{
    $issue = (new ReflectionClass(Issue::class))->newInstanceWithoutConstructor();
    $issue->setRawAttributes(['uuid' => 'issue-1', 'public_id' => 'issue_abc123', 'company_uuid' => $companyUuid], true);

    return new IssueCommentCreated($issue, (new ReflectionClass(Comment::class))->newInstanceWithoutConstructor(), 'customer');
}

function customerPortalIssueCommentUrl(IssueCommentCreated $notification): string
{
    $method = new ReflectionMethod($notification, 'customerPortalUrl');
    $method->setAccessible(true);

    return $method->invoke($notification);
}

test('queued issue comment notifications read the portal slug from the issue company', function () {
    $connection = customerPortalIssueCommentBoot();
    $connection->table('settings')->insert([
        ['key' => 'company.company-a.customer-portal-config', 'value' => json_encode(['accessUrlSlug' => 'acme-portal'])],
        ['key' => 'company.company-b.customer-portal-config', 'value' => json_encode(['accessUrlSlug' => 'other-portal'])],
    ]);

    // Queue workers have no company session
    session(['company' => null]);

    expect(customerPortalIssueCommentUrl(customerPortalIssueCommentNotification('company-a')))->toEndWith('/acme-portal/support/issue_abc123');
});

test('issue comment notifications fall back to the default portal slug', function () {
    customerPortalIssueCommentBoot();
    session(['company' => null]);

    expect(customerPortalIssueCommentUrl(customerPortalIssueCommentNotification('company-without-config')))->toEndWith('/customer-portal/support/issue_abc123');
});
