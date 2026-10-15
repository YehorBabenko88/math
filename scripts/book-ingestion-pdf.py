"""Local parser boundary. Never executes PDF actions, JavaScript or source commands."""
import argparse, base64, io, json, os, re, socket, sys

def deny_network(*args, **kwargs):
    raise RuntimeError('Network disabled')
socket.socket = deny_network
try:
    import resource
    resource.setrlimit(resource.RLIMIT_CPU, (10, 10))
    resource.setrlimit(resource.RLIMIT_AS, (768 * 1024**2, 768 * 1024**2))
except ImportError:
    pass  # Windows deployment needs host-level memory/filesystem/network containment.

def main():
    import pypdf
    if tuple(int(x) for x in pypdf.__version__.split('.')[:3]) < (6, 20, 0):
        raise ValueError('Patched pypdf runtime required')
    from pypdf import PdfReader
    p = argparse.ArgumentParser()
    p.add_argument('--input', required=True)
    p.add_argument('--page', type=int)
    p.add_argument('--render', action='store_true')
    p.add_argument('--region')
    args = p.parse_args()
    if os.path.getsize(args.input) > 32 * 1024**2:
        raise ValueError('Size')
    with open(args.input, 'rb') as handle:
        data = handle.read()
    reader = PdfReader(io.BytesIO(data), strict=True)
    if reader.is_encrypted:
        raise ValueError('Encrypted PDF')
    count = len(reader.pages)
    if not 1 <= count <= 10000:
        raise ValueError('Page count')
    if args.page is None:
        return {'pageCount': count}
    if not 1 <= args.page <= count:
        raise ValueError('Page')
    page = reader.pages[args.page - 1]
    width, height = float(page.mediabox.width), float(page.mediabox.height)
    if not (0 < width <= 2000 and 0 < height <= 2000):
        raise ValueError('Page geometry')
    contents = page.get_contents()
    if contents and len(contents.get_data()) > 4 * 1024**2:
        raise ValueError('Content stream')
    text = page.extract_text() or ''
    if len(text) > 100000:
        raise ValueError('Text limit')
    references = [{'kind': 'figure' if kind.lower() in ('figure', 'fig.') else 'table', 'label': kind + ' ' + number}
                  for kind, number in re.findall(r'\b(Figure|Fig\.|Table)\s+(\d{1,4})', text)][:100]
    image = None
    if args.render:
        import pypdfium2
        document = pypdfium2.PdfDocument(data)
        pdf_page = document[args.page - 1]
        bitmap = pdf_page.render(scale=1)
        output = io.BytesIO()
        picture = bitmap.to_pil()
        if args.region:
            region = json.loads(args.region)
            if not isinstance(region, list) or len(region) != 4 or any(type(n) not in (int, float) or not 0 <= n <= 1 for n in region):
                raise ValueError('Region')
            x, y, w, h = region
            if w <= 0 or h <= 0 or x + w > 1 or y + h > 1:
                raise ValueError('Region bounds')
            iw, ih = picture.size
            picture = picture.crop((int(x * iw), int(y * ih), int((x + w) * iw), int((y + h) * ih)))
        picture.save(output, format='PNG')
        image = base64.b64encode(output.getvalue()).decode('ascii')
        bitmap.close(); pdf_page.close(); document.close()
    resources = page.get('/Resources', {})
    resources = resources.get_object() if hasattr(resources, 'get_object') else resources
    xobjects = resources.get('/XObject', {})
    xobjects = xobjects.get_object() if hasattr(xobjects, 'get_object') else xobjects
    if len(xobjects) > 200:
        raise ValueError('Image resource limit')
    raster = any(obj.get_object().get('/Subtype') == '/Image' for obj in xobjects.values())
    return {'text': text, 'method': 'text', 'regions': [], 'references': references, 'image': image, 'rasterPresent': raster}

if __name__ == '__main__':
    try:
        result = main()
        print(json.dumps(result, ensure_ascii=True, allow_nan=False))
    except Exception:
        sys.stderr.write('PDF parser rejected input\n')
        sys.exit(1)
