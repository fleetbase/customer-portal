import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import { restartableTask, timeout } from 'ember-concurrency';

export default class PortalOrderFormRouteComponent extends Component {
    @service customerPortalOrderActions;
    @service customerPortalOrderCreation;
    @service customerPortalOrderRoutePreview;
    @service modalsManager;
    @service notifications;

    @tracked createdPlaces = [];
    @tracked placeFormContext;

    get places() {
        return [...this.createdPlaces, ...(this.args.places ?? [])];
    }

    get actionButtons() {
        const buttons = [
            {
                text: 'New Address',
                icon: 'plus',
                size: 'xs',
                wrapperClass: 'portal-order-panel-action-button',
                onClick: () => this.openPlaceForm('pickup'),
            },
        ];

        if (this.args.draft?.isMultipleDropoffOrder) {
            buttons.push({
                text: 'Add Waypoint',
                icon: 'map-location-dot',
                size: 'xs',
                wrapperClass: 'portal-order-panel-action-button',
                onClick: this.addWaypoint,
            });
        }

        return buttons;
    }

    get waypointRouteStops() {
        return (this.args.draft?.payload?.waypoints ?? []).map((waypoint, index) => {
            return {
                label: index + 1,
                required: index < 2,
                badgeStyle: this.badgeStyle(),
            };
        });
    }

    @restartableTask *searchPlaces(query) {
        const searchQuery = typeof query === 'string' ? query.trim() : '';

        if (searchQuery.length < 2) {
            return [];
        }

        yield timeout(350);

        const center = this.customerPortalOrderRoutePreview.centerCoordinates ?? {};

        const places = yield this.customerPortalOrderActions.searchPlaceCandidates.perform({
            query: searchQuery,
            geo: true,
            latitude: center.latitude,
            longitude: center.longitude,
        });

        return places;
    }

    @action setPayloadPlace(field, place) {
        this.customerPortalOrderCreation.setPayloadField(field, place);
        this.updateRoutePreview();
    }

    @action toggleMultiDrop(isMultipleDropoffOrder) {
        this.customerPortalOrderCreation.toggleMultiDrop(isMultipleDropoffOrder);
        this.updateRoutePreview();
    }

    @action addWaypoint() {
        this.customerPortalOrderCreation.addWaypoint();
        this.updateRoutePreview();
    }

    @action setWaypoint(index, place) {
        this.customerPortalOrderCreation.setWaypoint(index, place);
        this.updateRoutePreview();
    }

    @action setWaypointType(index, type) {
        this.customerPortalOrderCreation.setWaypointType(index, type);
        this.updateRoutePreview();
    }

    @action sortWaypoints({ sourceIndex, targetIndex }) {
        this.customerPortalOrderCreation.sortWaypoints(sourceIndex, targetIndex);
        this.updateRoutePreview();
    }

    @action removeWaypoint(index) {
        this.customerPortalOrderCreation.removeWaypoint(index);
        this.updateRoutePreview();
    }

    @action openPlaceForm(field, index = null) {
        this.placeFormContext = { field, index, mode: 'create' };
        const place = {};

        this.modalsManager.show('modals/portal-order-place-form', {
            title: 'New Address',
            modalClass: 'modal-md',
            acceptButtonText: 'Save Address',
            declineButtonText: 'Cancel',
            place,
            confirm: () => this.savePlace(place),
        });
    }

    @action openEditPlaceForm(field, place, index = null) {
        if (!place) {
            return;
        }

        this.placeFormContext = { field, index, mode: 'edit', originalPlace: place };
        const editablePlace = this.editablePlace(place);

        this.modalsManager.show('modals/portal-order-place-form', {
            title: 'Edit Address',
            modalClass: 'modal-md',
            acceptButtonText: 'Save Changes',
            declineButtonText: 'Cancel',
            place: editablePlace,
            confirm: () => this.savePlace(editablePlace),
        });
    }

    @action closePlaceForm() {
        this.placeFormContext = null;
    }

    @action async savePlace(place) {
        try {
            const isEdit = this.placeFormContext?.mode === 'edit';
            const id = this.customerPortalOrderActions.identifier(place);
            const savedPlace = isEdit && id ? await this.customerPortalOrderActions.updatePlace.perform(place) : place;

            if (!isEdit) {
                const createdPlace = await this.customerPortalOrderActions.createPlace.perform(place);
                this.createdPlaces = [createdPlace, ...this.createdPlaces];
                this.applyPlaceSelection(createdPlace);
            } else {
                this.applyPlaceSelection(savedPlace);
                this.updateCreatedPlace(savedPlace);
            }

            this.closePlaceForm();
            this.updateRoutePreview();
            this.notifications.success(isEdit ? 'Address updated.' : 'Address saved.');
        } catch (error) {
            this.notifications.serverError(error);
        }
    }

    applyPlaceSelection(place) {
        if (this.placeFormContext?.field === 'waypoint') {
            this.customerPortalOrderCreation.setWaypoint(this.placeFormContext.index, place);
        } else {
            this.customerPortalOrderCreation.setPayloadField(this.placeFormContext.field, place);
        }
    }

    updateCreatedPlace(place) {
        const id = this.customerPortalOrderActions.identifier(place);

        if (!id) {
            return;
        }

        this.createdPlaces = this.createdPlaces.map((candidate) => (this.customerPortalOrderActions.identifier(candidate) === id ? place : candidate));
    }

    editablePlace(place = {}) {
        return {
            id: typeof place.id === 'string' ? place.id : null,
            public_id: place.public_id,
            uuid: place.uuid,
            name: place.name,
            street1: place.street1 ?? place.address,
            street2: place.street2,
            neighborhood: place.neighborhood,
            building: place.building,
            security_access_code: place.security_access_code,
            postal_code: place.postal_code,
            city: place.city,
            province: place.province,
            country: place.country,
            phone: place.phone,
            latitude: place.latitude,
            longitude: place.longitude,
            location: place.location,
            address: place.address,
        };
    }

    updateRoutePreview() {
        const payload = this.customerPortalOrderCreation.draft?.payload ?? {};
        const places = this.customerPortalOrderCreation.draft?.isMultipleDropoffOrder
            ? (payload.waypoints ?? []).map((waypoint) => waypoint.place).filter(Boolean)
            : [payload.pickup, payload.dropoff, payload.return].filter(Boolean);
        this.customerPortalOrderCreation.updateRoutePreview(this.customerPortalOrderActions.coordinatesFromPlaces(places));
    }

    badgeStyle() {
        return 'background-color: #3485e2; color: #ffffff;';
    }
}
