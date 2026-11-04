
import { TestBed } from '@angular/core/testing';

import { AsgReportPaginatorService } from './asg-report-paginator.service';

describe('AsgReportPaginatorService', () => {
    let service: AsgReportPaginatorService;
    let container: HTMLElement;

    beforeEach(() => {
        TestBed.configureTestingModule({});

        service = TestBed.inject(AsgReportPaginatorService);

        container = document.createElement('div');
        document.body.appendChild(container);
    });

    afterEach(() => {
        container.remove();
    });

    it('should distribute blocks across multiple A4 pages', () => {
        const report = document.createElement('div');
        report.className = 'asg-report';

        const section = document.createElement('section');
        section.className = 'report-page';
        section.setAttribute('data-pdf-section', '');

        const firstBlock = document.createElement('div');
        firstBlock.setAttribute('data-pdf-keep', '');
        firstBlock.style.height = '700px';
        firstBlock.textContent = 'Primer bloque';

        const secondBlock = document.createElement('div');
        secondBlock.setAttribute('data-pdf-keep', '');
        secondBlock.style.height = '500px';
        secondBlock.textContent = 'Segundo bloque';

        section.append(firstBlock, secondBlock);
        report.appendChild(section);
        container.appendChild(report);

        const { workspace, pages } = service.paginate(report);

        try {
            expect(pages.length).toBe(2);

            expect(pages[0].textContent).toContain('Primer bloque');
            expect(pages[0].textContent).not.toContain('Segundo bloque');

            expect(pages[1].textContent).toContain('Segundo bloque');

            expect(
                workspace.querySelectorAll('[data-pdf-page]').length
            ).toBe(2);
        } finally {
            workspace.remove();
        }
    });

    it('should split table rows across pages and repeat headers', () => {
        const report = document.createElement('div');
        report.className = 'asg-report';

        const section = document.createElement('section');
        section.className = 'report-page';
        section.setAttribute('data-pdf-section', '');

        const table = document.createElement('table');
        table.className = 'report-table';
        table.style.width = '100%';

        const thead = table.createTHead();
        const header = thead.insertRow();
        const headerCell = document.createElement('th');
        headerCell.textContent = 'Ámbito';
        headerCell.style.height = '40px';
        header.appendChild(headerCell);

        const tbody = table.createTBody();

        for (let i = 1; i <= 20; i++) {
            const row = tbody.insertRow();
            row.style.height = '100px';

            const cell = row.insertCell();
            cell.textContent = `Ámbito ${i}`;
        }

        section.appendChild(table);
        report.appendChild(section);
        container.appendChild(report);

        const { workspace, pages } = service.paginate(report);

        try {
            expect(pages.length).toBeGreaterThan(1);

            const exportedRows = pages.flatMap(page =>
                Array.from(page.querySelectorAll('tbody tr'))
            );

            expect(exportedRows.length).toBe(20);

            for (const page of pages) {
                expect(page.querySelector('thead th')?.textContent)
                    .toBe('Ámbito');
            }

            expect(exportedRows[0].textContent).toContain('Ámbito 1');
            expect(exportedRows[19].textContent).toContain('Ámbito 20');
        } finally {
            workspace.remove();
        }
    });

    it('should distribute nested gaps without losing content', () => {
        const report = document.createElement('div');
        report.className = 'asg-report';

        const section = document.createElement('section');
        section.className = 'report-page';
        section.setAttribute('data-pdf-section', '');

        const gaps = document.createElement('div');
        gaps.className = 'report-gaps';

        for (let i = 1; i <= 4; i++) {
            const gap = document.createElement('div');
            gap.className = 'report-gap';
            gap.setAttribute('data-pdf-keep', '');
            gap.style.height = '350px';
            gap.textContent = `Brecha ${i}`;

            gaps.appendChild(gap);
        }

        section.appendChild(gaps);
        report.appendChild(section);
        container.appendChild(report);

        const { workspace, pages } = service.paginate(report);

        try {
            expect(pages.length).toBeGreaterThan(1);

            const exportedGaps = pages.flatMap(page =>
                Array.from(
                    page.querySelectorAll<HTMLElement>('.report-gap')
                )
            );

            expect(exportedGaps.length).toBe(4);

            for (let i = 1; i <= 4; i++) {
                expect(
                    exportedGaps[i - 1].textContent
                ).toContain(`Brecha ${i}`);
            }

            expect(
                pages.every(page =>
                    page.querySelectorAll('.report-gaps').length > 0
                )
            ).toBeTrue();
        } finally {
            workspace.remove();
        }
    });

    it('should reject blocks that exceed a full A4 page', () => {
        const report = document.createElement('div');
        report.className = 'asg-report';

        const section = document.createElement('section');
        section.className = 'report-page';
        section.setAttribute('data-pdf-section', '');

        const oversizedBlock = document.createElement('div');
        oversizedBlock.setAttribute('data-pdf-keep', '');
        oversizedBlock.style.height = '1500px';
        oversizedBlock.textContent = 'Contenido demasiado extenso';

        section.appendChild(oversizedBlock);
        report.appendChild(section);
        container.appendChild(report);

        expect(() => service.paginate(report)).toThrowError(
            'Un bloque del reporte supera la altura de una página A4.'
        );

        expect(
            container.querySelector('[data-pdf-workspace]')
        ).toBeNull();
    });

    it('should detect overflow inside nested containers', () => {
        const report = document.createElement('div');
        report.className = 'asg-report';

        const section = document.createElement('section');
        section.className = 'report-page';
        section.setAttribute('data-pdf-section', '');

        const wrapper = document.createElement('div');
        wrapper.style.height = '100px';
        wrapper.style.overflow = 'visible';

        const longContent = document.createElement('div');
        longContent.style.height = '1500px';
        longContent.textContent = 'Contenido anidado extenso';

        wrapper.appendChild(longContent);
        section.appendChild(wrapper);
        report.appendChild(section);
        container.appendChild(report);

        expect(() => service.paginate(report)).toThrowError();

        expect(
            container.querySelector('[data-pdf-workspace]')
        ).toBeNull();
    });

    it('should not create empty pages when paginating a table', () => {
        const report = document.createElement('div');
        report.className = 'asg-report';

        const section = document.createElement('section');
        section.className = 'report-page';
        section.setAttribute('data-pdf-section', '');

        const table = document.createElement('table');
        table.className = 'report-table';

        const thead = table.createTHead();
        const header = thead.insertRow();
        const headerCell = document.createElement('th');
        headerCell.textContent = 'Encabezado';
        headerCell.style.height = '40px';
        header.appendChild(headerCell);

        const tbody = table.createTBody();

        for (let i = 1; i <= 15; i++) {
            const row = tbody.insertRow();
            row.style.height = '120px';

            const cell = row.insertCell();
            cell.textContent = `Fila ${i}`;
        }

        section.appendChild(table);
        report.appendChild(section);
        container.appendChild(report);

        const { workspace, pages } = service.paginate(report);

        try {
            expect(pages.length).toBeGreaterThan(1);

            for (const page of pages) {
                const rows = page.querySelectorAll('tbody tr');

                expect(rows.length).toBeGreaterThan(0);
            }

            const exportedRows = pages.flatMap(page =>
                Array.from(page.querySelectorAll('tbody tr'))
            );

            expect(exportedRows.length).toBe(15);
        } finally {
            workspace.remove();
        }
    });

    it('should move a table to the next page when its header does not fit', () => {
        const report = document.createElement('div');
        report.className = 'asg-report';

        const section = document.createElement('section');
        section.className = 'report-page';
        section.setAttribute('data-pdf-section', '');

        const block = document.createElement('div');
        block.style.height = '950px';
        block.textContent = 'Contenido anterior';

        const table = document.createElement('table');
        table.className = 'report-table';
        table.style.width = '100%';

        const thead = table.createTHead();
        const header = thead.insertRow();

        const headerCell = document.createElement('th');
        headerCell.style.height = '80px';
        headerCell.textContent = 'Encabezado';

        header.appendChild(headerCell);

        const tbody = table.createTBody();
        const row = tbody.insertRow();

        row.style.height = '100px';
        row.insertCell().textContent = 'Primera fila';

        section.append(block, table);
        report.appendChild(section);
        container.appendChild(report);

        const { workspace, pages } = service.paginate(report);

        try {
            expect(pages.length).toBe(2);

            expect(pages[0].textContent).toContain('Contenido anterior');
            expect(pages[0].querySelector('table')).toBeNull();

            expect(pages[1].querySelector('thead th')?.textContent)
                .toBe('Encabezado');

            expect(pages[1].querySelector('tbody tr')?.textContent)
                .toBe('Primera fila');

            expect(
                pages.every(page => page.textContent?.trim())
            ).toBeTrue();
        } finally {
            workspace.remove();
        }
    });

    it('should split an oversized observation by paragraphs', () => {
        const report = document.createElement('div');
        report.className = 'asg-report';

        const section = document.createElement('section');
        section.className = 'report-page';
        section.setAttribute('data-pdf-section', '');

        const observation = document.createElement('div');
        observation.className = 'report-observation';
        observation.setAttribute('data-pdf-keep', '');

        const firstParagraph = document.createElement('p');
        firstParagraph.style.height = '700px';
        firstParagraph.textContent = 'Primera observación extensa';

        const secondParagraph = document.createElement('p');
        secondParagraph.style.height = '700px';
        secondParagraph.textContent = 'Segunda observación extensa';

        observation.append(firstParagraph, secondParagraph);
        section.appendChild(observation);
        report.appendChild(section);
        container.appendChild(report);

        const { workspace, pages } = service.paginate(report);

        try {
            expect(pages.length).toBe(2);

            const paragraphs = pages.flatMap(page =>
                Array.from(page.querySelectorAll('.report-observation p'))
            );

            expect(paragraphs.length).toBe(2);

            expect(paragraphs[0].textContent)
                .toBe('Primera observación extensa');

            expect(paragraphs[1].textContent)
                .toBe('Segunda observación extensa');

            expect(
                pages.every(page =>
                    page.querySelector('.report-observation') !== null
                )
            ).toBeTrue();
        } finally {
            workspace.remove();
        }
    });

    it('should split a single long paragraph without losing text', () => {
        const report = document.createElement('div');
        report.className = 'asg-report';

        const section = document.createElement('section');
        section.className = 'report-page';
        section.setAttribute('data-pdf-section', '');

        const observation = document.createElement('div');
        observation.className = 'report-observation';
        observation.setAttribute('data-pdf-keep', '');

        const paragraph = document.createElement('p');
        paragraph.style.fontSize = '16px';
        paragraph.style.lineHeight = '24px';
        paragraph.style.width = '600px';

        const originalText = Array.from(
            { length: 500 },
            (_, index) => `palabra${index + 1}`
        ).join(' ');

        paragraph.textContent = originalText;

        observation.appendChild(paragraph);
        section.appendChild(observation);
        report.appendChild(section);
        container.appendChild(report);

        const { workspace, pages } = service.paginate(report);

        try {
            expect(pages.length).toBeGreaterThan(1);

            const paragraphs = pages.flatMap(page =>
                Array.from(
                    page.querySelectorAll<HTMLParagraphElement>(
                        '.report-observation p'
                    )
                )
            );

            const exportedText = paragraphs
                .map(element => element.textContent?.trim() ?? '')
                .filter(Boolean)
                .join(' ');

            expect(exportedText).toBe(originalText);

            expect(
                pages.every(page =>
                    page.querySelector('.report-observation') !== null
                )
            ).toBeTrue();
        } finally {
            workspace.remove();
        }
    });

});
