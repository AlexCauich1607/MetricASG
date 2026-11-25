import {
    ChangeDetectionStrategy,
    Component,
    Input
} from '@angular/core';

import { UiStateComponent } from
    '../../../../shared/ui-state/ui-state.component';

export type DashboardSkeletonVariant = 'context' | 'results';

@Component({
    selector: 'app-dashboard-skeleton',
    standalone: true,
    imports: [UiStateComponent],
    templateUrl: './dashboard-skeleton.component.html',
    styleUrl: './dashboard-skeleton.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardSkeletonComponent {

    @Input() variant: DashboardSkeletonVariant = 'results';

    readonly cards = [0, 1, 2, 3];

}