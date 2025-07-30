/**
 * @fileoverview Ekstraktor tekstu z plików JSON i CSV
 * Konwertuje strukturę danych na czytelny tekst
 */

import type {
    TextExtractor,
    ExtractedText,
    ExtractionOptions
} from './text-extractor-interface.mjs';

/**
 * Ekstraktor tekstu z plików JSON i CSV
 */
export class JSONCSVExtractor implements TextExtractor {
    readonly name = 'json-csv-extractor';
    readonly supportedMimeTypes = [
        'application/json',
        'text/csv',
        'application/csv',
        'text/comma-separated-values'
    ];
    readonly supportedExtensions = ['.json', '.csv', '.tsv'];

    /**
     * Sprawdza czy może obsłużyć dany typ pliku
     */
    canHandle(mimeType: string, fileName?: string): boolean {
        if (this.supportedMimeTypes.includes(mimeType)) {
            return true;
        }

        if (fileName) {
            const extension = fileName.toLowerCase().split('.').pop();
            return extension ? this.supportedExtensions.includes(`.${extension}`) : false;
        }

        return false;
    }

    /**
     * Waliduje plik JSON/CSV
     */
    async validateFile(buffer: ArrayBuffer, fileName: string): Promise<boolean> {
        if (!buffer || buffer.byteLength === 0) {
            return false;
        }

        try {
            const text = new TextDecoder('utf-8').decode(buffer);
            const extension = fileName.toLowerCase().split('.').pop();

            if (extension === 'json') {
                // Sprawdź czy to valid JSON
                JSON.parse(text);
                return true;
            } else if (extension === 'csv' || extension === 'tsv') {
                // Sprawdź czy to prawdopodobnie CSV (ma separatory)
                const separator = extension === 'tsv' ? '\t' : ',';
                return text.includes(separator) || text.includes('\n');
            }

            return true;
        } catch {
            return false;
        }
    }

    /**
     * Szacuje czas przetwarzania
     */
    estimateProcessingTime(fileSize: number): number {
        // JSON/CSV parsing: ~0.3ms na KB + 80ms overhead
        return Math.max(80, fileSize * 0.0003);
    }

    /**
     * Wyodrębnia tekst z pliku JSON/CSV
     */
    async extractText(
        buffer: ArrayBuffer,
        fileName: string,
        options: ExtractionOptions = {}
    ): Promise<ExtractedText> {
        const startTime = Date.now();
        const {
            preserveFormatting = true,
            maxLength,
            extractStructure = true,
            encoding = 'utf-8'
        } = options;

        try {
            const content = new TextDecoder(encoding).decode(buffer);
            const extension = fileName.toLowerCase().split('.').pop() || '';

            let extractedText: string;
            let structure;
            let additionalInfo;

            if (extension === 'json') {
                const result = this.processJSON(content, preserveFormatting, extractStructure);
                extractedText = result.text;
                structure = result.structure;
                additionalInfo = result.info;
            } else {
                const separator = extension === 'tsv' ? '\t' : ',';
                const result = this.processCSV(content, separator, preserveFormatting, extractStructure);
                extractedText = result.text;
                structure = result.structure;
                additionalInfo = result.info;
            }

            // Ograniczenie długości jeśli podane
            if (maxLength && extractedText.length > maxLength) {
                extractedText = extractedText.substring(0, maxLength) + '...';
            }

            const processingTime = Date.now() - startTime;

            return {
                content: extractedText,
                metadata: {
                    fileType: extension,
                    fileSize: buffer.byteLength,
                    structure: structure ? this.convertToStandardStructure(structure, extension) : undefined,
                    // Dodatkowe metadane specyficzne dla typu
                    dataInfo: additionalInfo
                },
                extractionInfo: {
                    processingTime,
                    method: `${extension}-parser`,
                    isComplete: true
                }
            };

        } catch (error) {
            const processingTime = Date.now() - startTime;

            throw new Error(
                `JSON/CSV extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}. ` +
                `Processing time: ${processingTime}ms`
            );
        }
    }

    /**
     * Przetwarza JSON do tekstu
     */
    private processJSON(content: string, preserveFormatting: boolean, extractStructure: boolean) {
        const data = JSON.parse(content);

        let text = '';
        const structure = extractStructure ? this.analyzeJSONStructure(data) : undefined;

        if (preserveFormatting) {
            text = this.jsonToFormattedText(data);
        } else {
            text = this.jsonToPlainText(data);
        }

        const info = {
            type: 'json',
            isArray: Array.isArray(data),
            objectCount: this.countObjects(data),
            maxDepth: this.getMaxDepth(data),
            keys: this.extractKeys(data)
        };

        return { text, structure, info };
    }

    /**
     * Przetwarza CSV do tekstu
     */
    private processCSV(content: string, separator: string, preserveFormatting: boolean, extractStructure: boolean) {
        const lines = content.split('\n').map(line => line.trim()).filter(line => line);

        if (lines.length === 0) {
            return { text: '', structure: undefined, info: { type: 'csv', rowCount: 0, columnCount: 0 } };
        }

        // Parsuj CSV
        const rows = lines.map(line => this.parseCSVLine(line, separator));
        const headers = rows[0] || [];
        const dataRows = rows.slice(1);

        let text = '';
        let structure;

        if (preserveFormatting) {
            text = this.csvToFormattedText(headers, dataRows);
        } else {
            text = this.csvToPlainText(headers, dataRows);
        }

        if (extractStructure) {
            structure = {
                headers,
                sampleRows: dataRows.slice(0, 3) // Pierwsze 3 wiersze jako próbka
            };
        }

        const info = {
            type: 'csv',
            rowCount: dataRows.length,
            columnCount: headers.length,
            headers,
            hasHeaders: this.detectHeaders(headers, dataRows)
        };

        return { text, structure, info };
    }

    /**
     * Konwertuje JSON do sformatowanego tekstu
     */
    private jsonToFormattedText(data: any, depth = 0): string {
        const indent = '  '.repeat(depth);

        if (Array.isArray(data)) {
            if (data.length === 0) return '[]';

            let result = '[\n';
            for (let i = 0; i < data.length; i++) {
                result += `${indent}  ${this.jsonToFormattedText(data[i], depth + 1)}`;
                if (i < data.length - 1) result += ',';
                result += '\n';
            }
            result += `${indent}]`;
            return result;
        }

        if (typeof data === 'object' && data !== null) {
            const keys = Object.keys(data);
            if (keys.length === 0) return '{}';

            let result = '{\n';
            for (let i = 0; i < keys.length; i++) {
                const key = keys[i];
                result += `${indent}  "${key}": ${this.jsonToFormattedText(data[key], depth + 1)}`;
                if (i < keys.length - 1) result += ',';
                result += '\n';
            }
            result += `${indent}}`;
            return result;
        }

        return JSON.stringify(data);
    }

    /**
     * Konwertuje JSON do prostego tekstu
     */
    private jsonToPlainText(data: any): string {
        if (Array.isArray(data)) {
            return data.map(item => this.jsonToPlainText(item)).join(' ');
        }

        if (typeof data === 'object' && data !== null) {
            return Object.entries(data)
                .map(([key, value]) => `${key}: ${this.jsonToPlainText(value)}`)
                .join(' ');
        }

        return String(data);
    }

    /**
     * Konwertuje CSV do sformatowanego tekstu
     */
    private csvToFormattedText(headers: string[], rows: string[][]): string {
        let text = '';

        if (headers.length > 0) {
            text += `Headers: ${headers.join(', ')}\n\n`;
        }

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            text += `Row ${i + 1}:\n`;

            for (let j = 0; j < Math.min(row.length, headers.length); j++) {
                const header = headers[j] || `Column ${j + 1}`;
                text += `  ${header}: ${row[j] || ''}\n`;
            }
            text += '\n';
        }

        return text.trim();
    }

    /**
     * Konwertuje CSV do prostego tekstu
     */
    private csvToPlainText(headers: string[], rows: string[][]): string {
        let text = '';

        if (headers.length > 0) {
            text += headers.join(' ') + ' ';
        }

        for (const row of rows) {
            text += row.join(' ') + ' ';
        }

        return text.trim();
    }

    /**
     * Parsuje linię CSV z uwzględnieniem cytowań
     */
    private parseCSVLine(line: string, separator: string): string[] {
        const result: string[] = [];
        let current = '';
        let inQuotes = false;
        let quoteChar = '';

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (!inQuotes && (char === '"' || char === "'")) {
                inQuotes = true;
                quoteChar = char;
            } else if (inQuotes && char === quoteChar) {
                inQuotes = false;
                quoteChar = '';
            } else if (!inQuotes && char === separator) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }

        result.push(current.trim());
        return result;
    }

    /**
     * Pomocnicze metody do analizy JSON
     */
    private analyzeJSONStructure(data: any) {
        return {
            type: Array.isArray(data) ? 'array' : typeof data,
            keys: this.extractKeys(data),
            depth: this.getMaxDepth(data)
        };
    }

    private countObjects(data: any): number {
        if (Array.isArray(data)) {
            return data.reduce((count: number, item) => count + this.countObjects(item), 0);
        }
        if (typeof data === 'object' && data !== null) {
            const values = Object.values(data);
            const childCount = values.reduce((count: number, value: any) => count + this.countObjects(value), 0) as number;
            return 1 + childCount;
        }
        return 0;
    }

    private getMaxDepth(data: any, depth = 0): number {
        if (Array.isArray(data) || (typeof data === 'object' && data !== null)) {
            const values = Array.isArray(data) ? data : Object.values(data);
            return Math.max(depth, ...values.map(value => this.getMaxDepth(value, depth + 1)));
        }
        return depth;
    }

    private extractKeys(data: any): string[] {
        const keys = new Set<string>();

        const traverse = (obj: any) => {
            if (Array.isArray(obj)) {
                obj.forEach(traverse);
            } else if (typeof obj === 'object' && obj !== null) {
                Object.keys(obj).forEach(key => {
                    keys.add(key);
                    traverse(obj[key]);
                });
            }
        };

        traverse(data);
        return Array.from(keys);
    }

    private detectHeaders(headers: string[], rows: string[][]): boolean {
        if (headers.length === 0 || rows.length === 0) return false;

        // Proste heurystyki - nagłówki zazwyczaj są tekstowe i różne od danych
        const hasNonNumericHeaders = headers.some(header => isNaN(Number(header)));
        const firstRowHasNumbers = rows[0] && rows[0].some(cell => !isNaN(Number(cell)));

        return hasNonNumericHeaders && firstRowHasNumbers;
    }

    /**
     * Konwertuje strukturę JSON/CSV do standardowego formatu
     */
    private convertToStandardStructure(structure: any, fileType: string) {
        if (fileType === 'json') {
            return {
                headings: structure.keys?.slice(0, 10) || [], // Pierwsze 10 kluczy jako nagłówki
                sections: [{
                    title: `JSON Structure (${structure.type})`,
                    content: `Depth: ${structure.depth}, Keys: ${structure.keys?.length || 0}`,
                    level: 1
                }]
            };
        } else {
            // CSV
            return {
                headings: structure.headers || [],
                sections: [{
                    title: `CSV Data`,
                    content: `Rows: ${structure.sampleRows?.length || 0}, Columns: ${structure.headers?.length || 0}`,
                    level: 1
                }]
            };
        }
    }
}

/**
 * Factory function tworząca instancję ekstraktora JSON/CSV
 */
export function createJSONCSVExtractor(): TextExtractor {
    return new JSONCSVExtractor();
}
