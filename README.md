# GPT-6 Astra landing page (Django)

A Django project that recreates the animated spiral-galaxy "69" hero (a "6" and a "9" made of stars).
Move the cursor: stars are pushed away and swirl, then spring back, and the
whole galaxy leans in 3D toward the pointer. The round button (bottom right)
replays the fly-in animation.

## Run

    python -m venv venv
    source venv/bin/activate        # Windows: venv\Scripts\activate
    pip install -r requirements.txt
    python manage.py runserver

Open http://127.0.0.1:8000

## Where things are

- `config/settings.py`  – `SITE_BRAND` and the `GALAXY` dict (particle count, cursor radius/strength, spring, tilt)
- `landing/views.py`    – nav links and login menu
- `landing/templates/landing/index.html`
- `landing/static/landing/js/galaxy.js` – the Canvas particle animation (no libraries)
- `landing/static/landing/css/style.css`

This is a learning/demo replica. Change `SITE_BRAND` and the copy before publishing it anywhere.
