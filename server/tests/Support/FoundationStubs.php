<?php

/*
 * The package installs the individual illuminate/* components rather than
 * laravel/framework, so the few Foundation classes that core-api controllers,
 * requests and models extend are stubbed here for tests that load them.
 */

namespace Illuminate\Foundation\Auth\Access {
    if (!trait_exists(AuthorizesRequests::class)) {
        trait AuthorizesRequests
        {
        }
    }
}

namespace Illuminate\Foundation\Bus {
    if (!trait_exists(DispatchesJobs::class)) {
        trait DispatchesJobs
        {
        }
    }
}

namespace Illuminate\Foundation\Validation {
    if (!trait_exists(ValidatesRequests::class)) {
        trait ValidatesRequests
        {
        }
    }
}

namespace Illuminate\Foundation\Http {
    if (!class_exists(FormRequest::class)) {
        class FormRequest extends \Illuminate\Http\Request
        {
        }
    }
}

namespace Illuminate\Foundation\Auth {
    if (!class_exists(User::class)) {
        class User extends \Illuminate\Database\Eloquent\Model
        {
        }
    }
}
