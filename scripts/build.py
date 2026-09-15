"""Copy only public application assets into the deployment directory."""
from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[1]
out = root / 'dist'
if out.exists():
    shutil.rmtree(out)
out.mkdir()
for name in ['index.html', 'styles.css', 'app.js', 'logic.js', 'topology.js']:
    shutil.copy2(root / name, out / name)
for name in ['vendor', 'data']:
    shutil.copytree(root / name, out / name)
(out / '.nojekyll').touch()
print(f'Static site ready: {out}')
