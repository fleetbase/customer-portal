import Component from '@glimmer/component';
import { action } from '@ember/object';

export default class PortalOrderWorkspaceTableComponent extends Component {
    @action search(event) {
        if (typeof this.args.onSearch === 'function') {
            this.args.onSearch(event.target.value);
        }
    }
}
