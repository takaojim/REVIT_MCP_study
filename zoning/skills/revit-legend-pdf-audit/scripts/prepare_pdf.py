"""Prepare PDF evidence without altering the input or judging matches."""
import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
import pdfplumber


def prepare(pdf_path, output_path, dpi):
    source = Path(pdf_path).resolve(strict=True)
    output = Path(output_path).resolve()
    if output.exists():
        raise ValueError('Output exists; choose a fresh evidence directory.')
    if not 72 <= dpi <= 300:
        raise ValueError('DPI must be between 72 and 300.')
    with pdfplumber.open(source) as pdf:
        output.mkdir(parents=True)
        manifest = {
            'source_pdf': str(source),
            'sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
            'prepared_utc': datetime.now(timezone.utc).isoformat(),
            'page_count': len(pdf.pages), 'status': 'preparing', 'pages': [],
            'note': 'Preparation only. Candidate tables and text order require visual review.',
        }
        manifest_path = output / 'manifest.json'

        def save():
            manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')

        save()
        try:
            for number, page in enumerate(pdf.pages, 1):
                stem = f'page-{number:03d}'
                text = page.extract_text() or ''
                words = page.extract_words()
                table_error = None
                try:
                    tables = page.extract_tables()
                except Exception as exc:
                    tables = []
                    table_error = str(exc)
                (output / f'{stem}.txt').write_text(text, encoding='utf-8')
                (output / f'{stem}.json').write_text(json.dumps({
                    'physical_page': number,
                    'width_points': page.width, 'height_points': page.height,
                    'words': words, 'candidate_tables': tables,
                    'table_extraction_error': table_error,
                }, ensure_ascii=False, indent=2), encoding='utf-8')
                page.to_image(resolution=dpi).save(str(output / f'{stem}.png'))
                manifest['pages'].append({
                    'physical_page': number, 'text_file': f'{stem}.txt',
                    'data_file': f'{stem}.json', 'image_file': f'{stem}.png',
                    'characters': len(text), 'candidate_table_count': len(tables),
                    'needs_ocr': not bool(text.strip()),
                    'table_extraction_error': table_error,
                })
                save()
            manifest['status'] = 'prepared_requires_visual_review'
        except Exception as exc:
            manifest['status'] = 'incomplete'
            manifest['error'] = str(exc)
            raise
        finally:
            save()
    return manifest_path


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pdf', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--dpi', type=int, default=130)
    args = parser.parse_args()
    print(prepare(args.pdf, args.out, args.dpi))
