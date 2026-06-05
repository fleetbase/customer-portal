import Service from '@ember/service';

export default class CustomerPortalOrderValidationService extends Service {
    canCreate(draft) {
        return this.canQuote(draft);
    }

    canQuote(draft) {
        if (!draft?.orderConfig) {
            return false;
        }

        if (draft.isMultipleDropoffOrder) {
            return (draft.payload?.waypoints ?? []).filter((waypoint) => waypoint?.place).length >= 2;
        }

        return Boolean(draft.payload?.pickup && draft.payload?.dropoff);
    }
}
