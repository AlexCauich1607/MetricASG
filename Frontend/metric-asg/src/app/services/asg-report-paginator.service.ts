
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

                for (let index = 0; index < elements.length; index++) {
                    const content = elements[index];
                    const nextContent = elements[index + 1];

                    if (
                        content.matches('h2, h3') &&
                        nextContent
                    ) {
                        currentPage = this.keepHeadingWithNext(
                            content,
                            nextContent,
                            section,
                            currentPage,
                            workspace,
                            pages
                        );
                    }
                    if (content.classList.contains('report-action')) {
                        currentPage = this.appendAction(
                            content,
                            section,
                            currentPage,
                            workspace,
                            pages
                        );

                        continue;
                    }

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
    private keepHeadingWithNext(
        heading: HTMLElement,
        nextContent: HTMLElement,
        sourceSection: HTMLElement,
        currentPage: HTMLElement,
        workspace: HTMLElement,
        pages: HTMLElement[]
    ): HTMLElement {
        // No generar otra página si la actual todavía está vacía.
        if (currentPage.children.length === 0) {
            return currentPage;
        }

        const headingClone =
            heading.cloneNode(true) as HTMLElement;

        const contentClone =
            nextContent.cloneNode(true) as HTMLElement;

        // Para tablas, únicamente necesitamos comprobar
        // el encabezado y la primera fila.
        if (contentClone instanceof HTMLTableElement) {
            const body = contentClone.tBodies.item(0);

            if (body) {
                Array.from(body.rows)
                    .slice(1)
                    .forEach(row => row.remove());
            }
        }

        const fitsTogether = (page: HTMLElement): boolean => {
            page.append(headingClone, contentClone);

            try {
                return this.fitsInPage(page);
            } finally {
                headingClone.remove();
                contentClone.remove();
            }
        };

        // Si ambos elementos caben, conservar la página.
        if (fitsTogether(currentPage)) {
            return currentPage;
        }

        // Comprobar si ambos pueden trasladarse juntos
        // a una página completamente disponible.
        const candidatePage = this.createPage(sourceSection);

        workspace.appendChild(candidatePage);

        try {
            if (fitsTogether(candidatePage)) {
                pages.push(candidatePage);

                return candidatePage;
            }
        } catch (error) {
            candidatePage.remove();
            throw error;
        }

        // Si el conjunto supera una página completa,
        // conservar el procesamiento especializado existente.
        candidatePage.remove();

        return currentPage;
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
            const table =
                sourceTable.cloneNode(false) as HTMLTableElement;

            if (sourceTable.tHead) {
                table.appendChild(
                    sourceTable.tHead.cloneNode(true)
                );
            }

            const tbody =
                sourceBody.cloneNode(false) as HTMLTableSectionElement;

            table.appendChild(tbody);
            page.appendChild(table);

            return { table, tbody };
        };

        const createNextPage = (): HTMLElement => {
            const page = this.createPage(sourceSection);

            workspace.appendChild(page);
            pages.push(page);

            return page;
        };

        let output = createTable(currentPage);

        // Comprobar que el encabezado cabe en la página.
        if (!this.fitsInPage(currentPage)) {
            output.table.remove();

            // Evitar generar una página vacía.
            if (currentPage.children.length === 0) {
                throw new Error(
                    'El encabezado de la tabla supera el espacio disponible.'
                );
            }

            currentPage = createNextPage();

            output = createTable(currentPage);

            if (!this.fitsInPage(currentPage)) {
                throw new Error(
                    'El encabezado de la tabla supera el espacio disponible.'
                );
            }
        }

        for (const row of Array.from(sourceBody.rows)) {
            const clonedRow =
                row.cloneNode(true) as HTMLTableRowElement;

            output.tbody.appendChild(clonedRow);

            if (this.fitsInPage(currentPage)) {
                continue;
            }

            clonedRow.remove();

            // Si todavía no existen filas, retirar también
            // el encabezado para evitar una tabla huérfana.
            if (output.tbody.rows.length === 0) {
                output.table.remove();

                if (currentPage.children.length === 0) {
                    throw new Error(
                        'Una fila de la tabla supera la altura disponible de una página A4.'
                    );
                }
            }

            currentPage = createNextPage();

            output = createTable(currentPage);

            output.tbody.appendChild(clonedRow);

            if (!this.fitsInPage(currentPage)) {
                throw new Error(
                    'Una fila de la tabla supera la altura disponible de una página A4.'
                );
            }
        }

        return currentPage;
    }

    private fitsInPage(page: HTMLElement): boolean {
        const pageRect = page.getBoundingClientRect();

        const styles = getComputedStyle(page);

        const paddingTop =
            parseFloat(styles.paddingTop) || 0;

        const paddingBottom =
            parseFloat(styles.paddingBottom) || 0;

        const paddingLeft =
            parseFloat(styles.paddingLeft) || 0;

        const paddingRight =
            parseFloat(styles.paddingRight) || 0;

        const printableTop =
            pageRect.top + paddingTop;

        const printableBottom =
            pageRect.bottom - paddingBottom;

        const printableLeft =
            pageRect.left + paddingLeft;

        const printableRight =
            pageRect.right - paddingRight;

        // Tolerancia para diferencias de renderización
        // y redondeo de coordenadas subpíxel.
        const tolerance = 1;

        const elements = Array.from(
            page.querySelectorAll<HTMLElement>('*')
        );

        return elements.every(element => {
            const rect = element.getBoundingClientRect();

            // Ignorar elementos sin representación visual.
            if (rect.width === 0 && rect.height === 0) {
                return true;
            }

            const fitsVertically =
                rect.top >= printableTop - tolerance &&
                rect.bottom <= printableBottom + tolerance;

            const fitsHorizontally =
                rect.left >= printableLeft - tolerance &&
                rect.right <= printableRight + tolerance;

            return fitsVertically && fitsHorizontally;
        });
    }

    private appendAction(
        sourceAction: HTMLElement,
        sourceSection: HTMLElement,
        currentPage: HTMLElement,
        workspace: HTMLElement,
        pages: HTMLElement[]
    ): HTMLElement {
        // Intentar conservar la acción completa en la página actual.
        const action = sourceAction.cloneNode(true) as HTMLElement;

        currentPage.appendChild(action);

        if (this.fitsInPage(currentPage)) {
            return currentPage;
        }

        action.remove();

        // Si la página contiene información previa,
        // intentar colocar la acción completa en una nueva página.
        if (currentPage.children.length > 0) {
            currentPage = this.createPage(sourceSection);

            workspace.appendChild(currentPage);
            pages.push(currentPage);

            currentPage.appendChild(action);

            if (this.fitsInPage(currentPage)) {
                return currentPage;
            }

            action.remove();
        }

        // Si la acción tampoco cabe en una página completa,
        // reutilizar el mecanismo de división de contenido.
        return this.appendObservation(
            sourceAction,
            sourceSection,
            currentPage,
            workspace,
            pages
        );
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
                clonedChild instanceof HTMLElement &&
                clonedChild.matches('p, h4') &&
                Array.from(clonedChild.children).every(
                    element => element.matches('strong, b, em, span')
                )
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
                'Un elemento del reporte supera la altura de una página A4.'
            );
        }

        return currentPage;
    }

    private appendLongParagraph(
        paragraph: HTMLElement,
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
        const words = text.match(/\s*\S+\s*|\s+/g) ?? [];

        if (words.length === 0 || !text.trim()) {
            throw new Error(
                'El elemento no contiene texto divisible.'
            );
        }

        // Registrar las posiciones de las palabras en el texto original.
        const offsets: number[] = [0];

        for (const word of words) {
            offsets.push(
                offsets[offsets.length - 1] + word.length
            );
        }

        const walker = document.createTreeWalker(
            paragraph,
            NodeFilter.SHOW_TEXT
        );

        const textNodes: Text[] = [];

        let node = walker.nextNode();

        while (node) {
            textNodes.push(node as Text);
            node = walker.nextNode();
        }

        const resolvePosition = (offset: number): {
            node: Text;
            offset: number;
        } => {
            let remaining = offset;

            for (const textNode of textNodes) {
                if (remaining <= textNode.length) {
                    return {
                        node: textNode,
                        offset: remaining
                    };
                }

                remaining -= textNode.length;
            }

            const lastNode = textNodes[textNodes.length - 1];

            return {
                node: lastNode,
                offset: lastNode.length
            };
        };

        const setFragmentContent = (
            fragment: HTMLElement,
            start: number,
            length: number
        ): void => {
            const startPosition = resolvePosition(
                offsets[start]
            );

            const endPosition = resolvePosition(
                offsets[start + length]
            );

            const range = document.createRange();

            range.setStart(
                startPosition.node,
                startPosition.offset
            );

            range.setEnd(
                endPosition.node,
                endPosition.offset
            );

            fragment.replaceChildren(
                range.cloneContents()
            );
        };

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
            const fragment =
                paragraph.cloneNode(false) as HTMLElement;

            observation.appendChild(fragment);

            let low = 1;
            let high = words.length - position;
            let best = 0;

            // Determinar la mayor cantidad de palabras
            // que cabe en el espacio disponible.
            while (low <= high) {
                const middle = Math.floor((low + high) / 2);

                setFragmentContent(
                    fragment,
                    position,
                    middle
                );

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
                        'Una palabra del elemento supera el espacio disponible.'
                    );
                }

                if (observation.children.length === 0) {
                    observation.remove();
                }

                createContinuation();

                continue;
            }

            setFragmentContent(
                fragment,
                position,
                best
            );

            position += best;

            if (position < words.length) {
                createContinuation();
            }
        }

        return {
            page,
            observation
        };
    }

}
