import Component from '@glimmer/component';

export default class PortalOrderDetailsCustomFieldsComponent extends Component {
    get hasCustomFields() {
        return (this.args.resource?.custom_field_values ?? []).length > 0;
    }
}
