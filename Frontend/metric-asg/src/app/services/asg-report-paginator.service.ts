
import { Injectable } from '@angular/core';

export interface AsgReportSectionMeasurement {
    sectionIndex: number;
    contentHeight: number;
    availableHeight: number;
    overflows: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class AsgReportPaginatorService {

    private readonly pageHeight = 1123;
    private readonly pagePadding = 56;
    private readonly pageWidth = 794;

    measureSections(
        reportElement: HTMLElement
    ): AsgReportSectionMeasurement[] {
        const sections = Array.from(
            reportElement.querySelectorAll<HTMLElement>(
                '[data-pdf-section]'
            )
        );

        const availableHeight =
            this.pageHeight - this.pagePadding * 2;

        return sections.map((section, index) => {
            const contentHeight = section.scrollHeight -
                this.pagePadding * 2;

            return {
                sectionIndex: index,
                contentHeight,
                availableHeight,
                overflows: contentHeight > availableHeight
            };
        });
    }
    createPage(sourceSection: HTMLElement): HTMLElement {
        const page = sourceSection.cloneNode(false) as HTMLElement;

        page.removeAttribute('data-pdf-section');
        page.setAttribute('data-pdf-page', '');

        page.style.width = `${this.pageWidth}px`;
        page.style.height = `${this.pageHeight}px`;
        page.style.minHeight = `${this.pageHeight}px`;
        page.style.padding = `${this.pagePadding}px`;
        page.style.boxSizing = 'border-box';
        page.style.backgroundColor = '#ffffff';
        page.style.overflow = 'hidden';

        return page;
    }
    createWorkspace(reportElement: HTMLElement): HTMLElement {
        const workspace = reportElement.cloneNode(false) as HTMLElement;

        workspace.removeAttribute('data-pdf-root');
        workspace.setAttribute('data-pdf-workspace', '');

        workspace.style.position = 'absolute';
        workspace.style.left = '0';
        workspace.style.top = '0';
        workspace.style.width = `${this.pageWidth}px`;
        workspace.style.height = 'auto';
        workspace.style.visibility = 'visible';
        workspace.style.pointerEvents = 'none';
        workspace.style.zIndex = '-1';

        reportElement.parentElement?.appendChild(workspace);

        return workspace;
    }

    paginate(
        reportElement: HTMLElement
    ): {
        workspace: HTMLElement;
        pages: HTMLElement[];
    } {
        const sections = Array.from(
            reportElement.querySelectorAll<HTMLElement>(
                '[data-pdf-section]'
            )
        );

        if (sections.length === 0) {
            throw new Error('No se encontraron secciones del reporte.');
        }

        const workspace = this.createWorkspace(reportElement);
        const pages: HTMLElement[] = [];

        try {
            for (const section of sections) {
                let currentPage = this.createPage(section);

                workspace.appendChild(currentPage);
                pages.push(currentPage);

                const elements = Array.from(section.children).flatMap(element => {
                    if (!element.classList.contains('report-gaps')) {
                        return [element.cloneNode(true) as HTMLElement];
                    }

                    return Array.from(element.children).map(gap => {
                        const container = element.cloneNode(false) as HTMLElement;

                        container.appendChild(gap.cloneNode(true));

                        return container;
                    });
                });

                for (const content of elements) {
                    if (content.classList.contains('report-observation')) {
                        currentPage = this.appendObservation(
                            content,
                            section,
                            currentPage,
                            workspace,
                            pages
                        );

                        continue;
                    }
                    if (content instanceof HTMLTableElement) {
                        currentPage = this.appendTable(
                            content,
                            section,
                            currentPage,
                            workspace,
                            pages
                        );

                        continue;
                    }

                    currentPage.appendChild(content);

                    if (this.fitsInPage(currentPage)) {
                        continue;
                    }

                    currentPage.removeChild(content);

                    if (currentPage.children.length === 0) {
                        throw new Error(
                            'Un bloque del reporte supera la altura de una página A4.'
                        );
                    }

                    currentPage = this.createPage(section);

                    workspace.appendChild(currentPage);
                    pages.push(currentPage);

                    currentPage.appendChild(content);

                    if (!this.fitsInPage(currentPage)) {
                        throw new Error(
                            'Un bloque del reporte necesita dividirse entre páginas.'
                        );
                    }
                }
            }

            return { workspace, pages };
        } catch (error) {
            workspace.remove();
            throw error;
        }
    }

    private appendTable(
        sourceTable: HTMLTableElement,
        sourceSection: HTMLElement,
        currentPage: HTMLElement,
        workspace: HTMLElement,
        pages: HTMLElement[]
    ): HTMLElement {
        const sourceBody = sourceTable.tBodies.item(0);

        if (!sourceBody) {
            throw new Error(
                'La tabla del reporte no contiene un cuerpo válido.'
            );
        }

        const createTable = (page: HTMLElement) => {
            const table = sourceTable.cloneNode(false) as HTMLTableElement;

            if (sourceTable.tHead) {
                table.appendChild(sourceTable.tHead.cloneNode(true));
            }

            const tbody = sourceBody.cloneNode(false) as HTMLTableSectionElement;

            table.appendChild(tbody);
            page.appendChild(table);

            return { table, tbody };
        };

        const fits = (page: HTMLElement): boolean =>
            this.fitsInPage(page);

        let output = createTable(currentPage);

        // Si el encabezado no cabe, iniciamos una nueva página.
        if (!fits(currentPage)) {
            output.table.remove();

            currentPage = this.createPage(sourceSection);
            workspace.appendChild(currentPage);
            pages.push(currentPage);

            output = createTable(currentPage);

            if (!fits(currentPage)) {
                throw new Error(
                    'El encabezado de la tabla supera el espacio disponible.'
                );
            }
        }

        for (const row of Array.from(sourceBody.rows)) {
            const clonedRow = row.cloneNode(true) as HTMLTableRowElement;

            output.tbody.appendChild(clonedRow);

            if (fits(currentPage)) {
                continue;
            }

            clonedRow.remove();

            currentPage = this.createPage(sourceSection);
            workspace.appendChild(currentPage);
            pages.push(currentPage);

            output = createTable(currentPage);
            output.tbody.appendChild(clonedRow);

            if (!fits(currentPage)) {
                throw new Error(
                    'Una fila de la tabla supera la altura disponible de una página A4.'
                );
            }
        }

        return currentPage;
    }

    private fitsInPage(page: HTMLElement): boolean {
        const pageRect = page.getBoundingClientRect();

        const contentTop = pageRect.top + this.pagePadding;
        const contentBottom = pageRect.bottom - this.pagePadding;

        const elements = Array.from(
            page.querySelectorAll<HTMLElement>('*')
        );

        return elements.every(element => {
            const rect = element.getBoundingClientRect();

            if (rect.width === 0 && rect.height === 0) {
                return true;
            }

            return (
                rect.top >= contentTop - 1 &&
                rect.bottom <= contentBottom + 1
            );
        });
    }


    private appendObservation(
        sourceObservation: HTMLElement,
        sourceSection: HTMLElement,
        currentPage: HTMLElement,
        workspace: HTMLElement,
        pages: HTMLElement[]
    ): HTMLElement {
        const children = Array.from(sourceObservation.children);

        const createObservation = (page: HTMLElement): HTMLElement => {
            const observation = sourceObservation.cloneNode(false) as HTMLElement;

            page.appendChild(observation);

            return observation;
        };

        let output = createObservation(currentPage);

        for (const child of children) {
            const clonedChild = child.cloneNode(true) as HTMLElement;

            output.appendChild(clonedChild);

            if (this.fitsInPage(currentPage)) {
                continue;
            }

            clonedChild.remove();

            // Si ya hay contenido en la página, probamos una nueva.
            if (currentPage.children.length > 1 || output.children.length > 0) {
                if (output.children.length === 0) {
                    output.remove();
                }

                currentPage = this.createPage(sourceSection);
                workspace.appendChild(currentPage);
                pages.push(currentPage);

                output = createObservation(currentPage);
                output.appendChild(clonedChild);

                if (this.fitsInPage(currentPage)) {
                    continue;
                }

                clonedChild.remove();
            }

            if (
                clonedChild instanceof HTMLParagraphElement &&
                clonedChild.childElementCount === 0
            ) {
                const result = this.appendLongParagraph(
                    clonedChild,
                    sourceObservation,
                    sourceSection,
                    currentPage,
                    output,
                    workspace,
                    pages
                );

                currentPage = result.page;
                output = result.observation;

                continue;
            }

            throw new Error(
                'Un elemento de la observación supera la altura de una página A4.'
            );
        }

        return currentPage;
    }

    private appendLongParagraph(
        paragraph: HTMLParagraphElement,
        sourceObservation: HTMLElement,
        sourceSection: HTMLElement,
        currentPage: HTMLElement,
        currentObservation: HTMLElement,
        workspace: HTMLElement,
        pages: HTMLElement[]
    ): {
        page: HTMLElement;
        observation: HTMLElement;
    } {
        const text = paragraph.textContent ?? '';
        const words = text.match(/\S+\s*/g) ?? [];

        if (words.length === 0) {
            throw new Error(
                'El párrafo no contiene texto divisible.'
            );
        }

        let position = 0;
        let page = currentPage;
        let observation = currentObservation;

        const createContinuation = (): void => {
            page = this.createPage(sourceSection);
            workspace.appendChild(page);
            pages.push(page);

            observation =
                sourceObservation.cloneNode(false) as HTMLElement;

            page.appendChild(observation);
        };

        while (position < words.length) {
            const fragment = paragraph.cloneNode(false) as HTMLParagraphElement;

            observation.appendChild(fragment);

            let low = 1;
            let high = words.length - position;
            let best = 0;

            while (low <= high) {
                const middle = Math.floor((low + high) / 2);

                fragment.textContent = words
                    .slice(position, position + middle)
                    .join('');

                if (this.fitsInPage(page)) {
                    best = middle;
                    low = middle + 1;
                } else {
                    high = middle - 1;
                }
            }

            if (best === 0) {
                fragment.remove();

                const hasOtherContent =
                    observation.children.length > 0 ||
                    page.children.length > 1;

                if (!hasOtherContent) {
                    throw new Error(
                        'Una palabra del párrafo supera el espacio disponible.'
                    );
                }

                if (observation.children.length === 0) {
                    observation.remove();
                }

                createContinuation();
                continue;
            }

            fragment.textContent = words
                .slice(position, position + best)
                .join('')
                .trimEnd();

            position += best;

            if (position < words.length) {
                createContinuation();
            }
        }

        return { page, observation };
    }

}
