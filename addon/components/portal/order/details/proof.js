import Component from '@glimmer/component';

export default class PortalOrderDetailsProofComponent extends Component {
    get proofs() {
        return this.args.resource?.proofs ?? this.args.resource?.pod ?? this.args.resource?.proof_of_delivery ?? [];
    }

    get hasProofs() {
        return this.proofs.length > 0;
    }
}
