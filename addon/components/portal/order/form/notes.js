import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class PortalOrderFormNotesComponent extends Component {
    @service customerPortalOrderCreation;

    @action setNotes(event) {
        this.customerPortalOrderCreation.setField('notes', event.target.value);
    }
}
