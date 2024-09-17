import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';

export default class PortalHeaderComponent extends Component {
    @service router;
    @service hostRouter;
    @service universe;
    @service currentUser;
    @service abilities;
    @service fetch;
    @tracked company;
    @tracked menuItems = [];
    @tracked userMenuItems = [];

    constructor(owner, { menuItems = [], userMenuItems = [] }) {
        super(...arguments);
        this.company = this.currentUser.getCompany();
        this.menuItems = this.mergeMenuItems(menuItems);
        this.userMenuItems = this.mergeUserMenuItems(userMenuItems);
    }

    mergeMenuItems(menuItems = []) {
        const headerMenuItems = this.universe.portalHeaderMenuItems ?? [];

        // Push provided menu items
        headerMenuItems.pushObjects(menuItems);

        // Callback to allow mutation of menu items
        if (typeof this.args.mutateMenuItems === 'function') {
            this.args.mutateMenuItems(headerMenuItems);
        }

        return headerMenuItems;
    }

    mergeUserMenuItems(userMenuItems = []) {
        // Prepare menu items
        const menuItems = [
            {
                text: [this.currentUser.email, this.currentUser.companyName],
                class: 'flex flex-row items-center px-3 rounded-md text-gray-800 text-sm dark:text-gray-300 leading-1',
                wrapperClass: 'next-dd-session-user-wrapper',
            },
            {
                id: 'view-profile-user-nav-item',
                wrapperClass: 'view-profile-user-nav-item',
                route: 'portal.account',
                text: 'Account',
            },
        ];

        // Push provided menu items
        menuItems.pushObjects(userMenuItems);

        // Create immutable static menu items
        menuItems.pushObjects([
            {
                component: 'layout/header/dark-mode-toggle',
            },
            {
                seperator: true,
            },
            {
                href: 'javascript:;',
                text: 'Logout',
                action: 'invalidateSession',
                icon: 'person-running',
            },
        ]);

        // Callback to allow mutation of menu items
        if (typeof this.args.mutateUserMenuItems === 'function') {
            this.args.mutateUserMenuItems(menuItems);
        }

        return menuItems;
    }

    @action routeTo(route) {
        const router = this.router ?? this.hostRouter;

        return router.transitionTo(route);
    }
}
