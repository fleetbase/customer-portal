import Controller from '@ember/controller';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class PortalAddressBookController extends Controller {
    @service fetch;
    @service modalsManager;
    @service notifications;

    get places() {
        return this.model?.places ?? [];
    }

    get actionButtons() {
        return [
            {
                text: 'New Place',
                icon: 'plus',
                size: 'xs',
                wrapperClass: 'portal-order-panel-action-button',
                onClick: this.createPlace,
            },
        ];
    }

    @action createPlace() {
        const place = {};

        this.modalsManager.show('modals/portal-order-place-form', {
            title: 'New Place',
            modalClass: 'modal-md',
            acceptButtonText: 'Save Place',
            declineButtonText: 'Cancel',
            place,
            confirm: () => this.savePlace(place),
        });
    }

    @action editPlace(place) {
        const editablePlace = {
            uuid: place.uuid,
            public_id: place.public_id,
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

        this.modalsManager.show('modals/portal-order-place-form', {
            title: 'Edit Place',
            modalClass: 'modal-md',
            acceptButtonText: 'Save Changes',
            declineButtonText: 'Cancel',
            place: editablePlace,
            confirm: () => this.savePlace(editablePlace),
        });
    }

    @action async deletePlace(place) {
        await this.modalsManager.confirm({
            title: 'Delete saved place?',
            body: 'This removes the place from your customer portal address book.',
            acceptButtonText: 'Delete',
            acceptButtonType: 'danger',
            confirm: async () => {
                try {
                    await this.fetch.delete(`places/${this.identifier(place)}`, {}, { namespace: 'customer-portal/int/v1' });
                    this.model = {
                        ...this.model,
                        places: this.places.filter((candidate) => this.identifier(candidate) !== this.identifier(place)),
                    };
                    this.notifications.success('Place removed.');
                } catch (error) {
                    this.notifications.serverError(error);
                }
            },
        });
    }

    async savePlace(place) {
        try {
            const id = this.identifier(place);
            const response = id
                ? await this.fetch.patch(`places/${id}`, place, { namespace: 'customer-portal/int/v1' })
                : await this.fetch.post('places', place, { namespace: 'customer-portal/int/v1' });
            const savedPlace = response.place ?? response;
            const existingIndex = this.places.findIndex((candidate) => this.identifier(candidate) === this.identifier(savedPlace));
            const places = [...this.places];

            if (existingIndex > -1) {
                places.splice(existingIndex, 1, savedPlace);
            } else {
                places.unshift(savedPlace);
            }

            this.model = {
                ...this.model,
                places,
            };
            this.notifications.success(id ? 'Place updated.' : 'Place saved.');
        } catch (error) {
            this.notifications.serverError(error);
        }
    }

    identifier(place) {
        return place?.uuid ?? place?.public_id ?? (typeof place?.id === 'string' ? place.id : null);
    }
}
