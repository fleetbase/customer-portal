import Component from '@glimmer/component';

export default class PortalOrderFormCustomFieldsComponent extends Component {
    get customFieldGroups() {
        return this.args.draft?.customFields?.customFieldGroups ?? [];
    }

    get hasCustomFields() {
        return this.customFieldGroups.length > 0;
    }
}
