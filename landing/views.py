from django.conf import settings
from django.shortcuts import render

NAV_LINKS = ["Research", "Products", "Business", "Developers", "Company", "Foundation"]

LOGIN_MENU = [
    {"label": "ChatGPT", "url": "#"},
    {"label": "API platform", "url": "#"},
]


def index(request):
    context = {
        "page_title": "GPT-6 Astra",
        "brand": settings.SITE_BRAND,
        "nav_links": NAV_LINKS,
        "login_menu": LOGIN_MENU,
        "galaxy_config": settings.GALAXY,
    }
    return render(request, "landing/index.html", context)
