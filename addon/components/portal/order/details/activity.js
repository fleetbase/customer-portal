import Component from '@glimmer/component';
import { arrayFor, valueFor } from '../../../../utils/model-access';

export default class PortalOrderDetailsActivityComponent extends Component {
    get activities() {
        const activities = arrayFor(valueFor(this.args.resource, 'tracking_statuses')).sort(
            (a, b) => new Date(valueFor(b, 'created_at') ?? 0).getTime() - new Date(valueFor(a, 'created_at') ?? 0).getTime()
        );

        return activities.map((activity, index) => ({
            status: valueFor(activity, 'status'),
            details: valueFor(activity, 'details'),
            created_at: valueFor(activity, 'created_at'),
            isCurrent: index === 0,
        }));
    }

    get currentActivity() {
        return this.activities[0] ?? null;
    }
}
