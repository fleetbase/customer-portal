import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

export default class PortalOrderFormPlaceFormComponent extends Component {
    @tracked name;
    @tracked street1;
    @tracked phone;
    @tracked latitude;
    @tracked longitude;

    get canSave() {
        return Boolean(this.street1);
    }

    @action setInput(field, event) {
        this[field] = event.target.value;
    }

    @action save() {
        if (!this.canSave) {
            return;
        }

        this.args.onSave?.({
            name: this.name,
            street1: this.street1,
            address: this.street1,
            phone: this.phone,
            latitude: this.latitude,
            longitude: this.longitude,
        });
    }
}
