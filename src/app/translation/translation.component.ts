import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as XLSX from 'xlsx';
import { KeyValuePipe } from '@angular/common';
import { MatTabsModule } from '@angular/material/tabs';

interface TranslationRow {
  key: string;
  [lang: string]: string;
}

@Component({
  selector: 'app-translation',
  imports: [CommonModule, KeyValuePipe, MatTabsModule],
  templateUrl: './translation.component.html',
  styleUrl: './translation.component.scss',
})
export class TranslationComponent {
  excelData: TranslationRow[] = [];
  jsonFiles: { [lang: string]: any } = {};
  outputExcel: any;

  onJsonUpload(event: any): void {
    const files: FileList = event.target.files;
    let loaded = 0;

    for (let i = 0; i < files.length; i++) {
      const reader = new FileReader();
      const lang = files[i].name.replace('.json', '');

      reader.onload = (e: any) => {
        const jsonContent = JSON.parse(e.target.result);
        const flat = this.flattenJson(jsonContent);
        this.jsonFiles[lang] = flat;
        loaded++;

        if (loaded === files.length) {
          this.buildExcelFromJson();
        }
      };

      reader.readAsText(files[i]);
    }
  }

  flattenJson(obj: any, prefix: string = ''): any {
    let result: any = {};
    for (const key in obj) {
      const val = obj[key];
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (typeof val === 'object' && val !== null) {
        result = { ...result, ...this.flattenJson(val, fullKey) };
      } else {
        result[fullKey] = val;
      }
    }
    return result;
  }

  buildExcelFromJson(): void {
    const allKeys = new Set<string>();
    Object.values(this.jsonFiles).forEach((langMap) => {
      Object.keys(langMap).forEach((key) => allKeys.add(key));
    });

    const rows: any[] = [];
    allKeys.forEach((key) => {
      const row: any = { key };
      for (const lang in this.jsonFiles) {
        row[lang] = this.jsonFiles[lang][key] ?? '';
      }
      rows.push(row);
    });

    this.excelData = rows;

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Translations');
    this.outputExcel = XLSX.write(workbook, {
      bookType: 'xlsx',
      type: 'array',
    });
  }

  downloadExcel(): void {
    const blob = new Blob([this.outputExcel], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'translations.xlsx';
    a.click();
    window.URL.revokeObjectURL(url);
  }

  onExcelUpload(event: any): void {
    const file = event.target.files[0];
    const reader = new FileReader();
    reader.onload = (e: any) => {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      const langs = Object.keys(rows[0]).filter((k) => k !== 'key');

      for (const lang of langs) {
        const flatDict: any = {};
        for (const row of rows) {
          flatDict[row['key']] = row[lang];
        }
        const nested = this.nestKeys(flatDict);
        const blob = new Blob([JSON.stringify(nested, null, 2)], {
          type: 'application/json',
        });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${lang}.json`;
        a.click();
      }
    };
    reader.readAsArrayBuffer(file);
  }

  nestKeys(flatDict: any): any {
    const result: any = {};
    for (const flatKey in flatDict) {
      const value = flatDict[flatKey];
      const keys = flatKey.split('.');
      let curr = result;
      keys.forEach((k, i) => {
        if (i === keys.length - 1) {
          curr[k] = value;
        } else {
          curr = curr[k] = curr[k] || {};
        }
      });
    }
    return result;
  }

  clearJsonFiles() {
    this.excelData = [];
  }
}
