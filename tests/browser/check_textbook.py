from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from unittest import TestCase, main
from urllib.parse import urlsplit

from playwright.sync_api import expect, sync_playwright


BUILD = Path(__file__).resolve().parents[2] / "build"


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=BUILD, **kwargs)

    def log_message(self, *args):
        pass


class TextbookChecks(TestCase):
    @classmethod
    def setUpClass(cls):
        if not (BUILD / "search-index.json").is_file():
            raise RuntimeError("Run python scripts/build.py before the browser checks")
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        cls.addClassCleanup(server.server_close)
        Thread(target=server.serve_forever, daemon=True).start()
        cls.addClassCleanup(server.shutdown)
        cls.base = f"http://127.0.0.1:{server.server_port}/"
        playwright = sync_playwright().start()
        cls.addClassCleanup(playwright.stop)
        cls.browser = playwright.chromium.launch(channel="chrome")
        cls.addClassCleanup(cls.browser.close)

    def setUp(self):
        self.page = self.browser.new_page(reduced_motion="reduce")
        self.addCleanup(self.page.close)

    def test_system_theme_updates_reader_and_manual_choice_survives_reload(self):
        self.page.emulate_media(color_scheme="dark")
        self.page.route("**/java/first-program.html?v=31", lambda route: route.abort())
        self.page.goto(self.base + "#java-first-program")
        root = self.page.locator("html")
        reader = self.page.frame_locator("#frame").locator("html")
        expect(root).to_have_attribute("data-theme", "dark")
        expect(reader).to_have_attribute("data-theme", "dark")
        self.page.emulate_media(color_scheme="light")
        expect(reader).to_have_attribute("data-theme", "light")
        self.page.locator(".tb-theme-toggle").click()
        self.page.get_by_role("button", name="Тёмная", exact=True).click()
        self.page.reload()
        expect(root).to_have_attribute("data-theme", "dark")
        expect(reader).to_have_attribute("data-theme", "dark")
        self.page.locator(".tb-theme-toggle").click()
        self.page.get_by_role("button", name="Как в системе").click()
        expect(reader).to_have_attribute("data-theme", "light")

    def test_standalone_material_opens_updates_without_legacy_script(self):
        requests = []

        def record_updates_request(request):
            if urlsplit(request.url).path.endswith("/site-updates.js"):
                requests.append(request.url)

        self.page.on("request", record_updates_request)
        for path in ("java/arrays.html", "it/lecture-01.html"):
            with self.subTest(path=path):
                requests.clear()
                self.page.goto(self.base + path)
                self.page.locator(".tb-more summary").click()
                self.page.get_by_role("button", name="Что нового", exact=True).click()
                dialog = self.page.get_by_role("dialog")
                expect(dialog.get_by_role("heading", name="Оформление и навигация")).to_be_visible()
                self.page.keyboard.press("Escape")
                self.assertEqual(len(requests), 1, requests)
                self.assertFalse(requests[0].endswith("?v=1"), requests)

    def test_updates_returns_focus_to_menu_on_tablet(self):
        self.page.set_viewport_size({"width": 1024, "height": 768})
        self.page.goto(self.base)
        menu = self.page.get_by_role("button", name="Меню", exact=True)
        menu.click()
        self.page.locator(".tb-more summary").click()
        self.page.get_by_role("button", name="Помощь и идеи").click()
        expect(self.page.get_by_role("textbox", name="Сообщение")).to_be_visible()
        self.page.keyboard.press("Escape")
        expect(menu).to_be_focused()

    def test_course_picker_opens_with_keyboard_on_narrow_screen(self):
        self.page.set_viewport_size({"width": 390, "height": 780})
        self.page.goto(self.base + "#java")
        self.page.get_by_role("button", name="Темы", exact=True).click()
        picker = self.page.locator(".course-picker summary")
        picker.press("Enter")
        options = self.page.locator(".course-picker")
        expect(options.get_by_role("link", name="Java", exact=True)).to_have_attribute("aria-current", "true")
        picker.press("Escape")
        expect(options).not_to_have_attribute("open", "")
        picker.press("Enter")
        options.get_by_role("link", name="Базы данных и SQL").press("Enter")
        expect(self.page).to_have_url(self.base + "#home")

    def test_updates_scrolls_inside_dialog_and_returns_focus(self):
        self.page.set_viewport_size({"width": 390, "height": 680})
        self.page.goto(self.base)
        menu = self.page.get_by_role("button", name="Меню", exact=True)
        menu.click()
        self.page.locator(".tb-more summary").click()
        self.page.get_by_role("button", name="Что нового", exact=True).click()
        dialog = self.page.get_by_role("dialog")
        expect(dialog.get_by_role("heading", name="Оформление и навигация")).to_be_visible()
        scroll = dialog.locator(".su-body")
        scroll.evaluate("area => area.scrollTop = area.scrollHeight")
        self.assertGreater(scroll.evaluate("area => area.scrollTop"), 0)
        self.assertEqual(dialog.evaluate("dialog => dialog.scrollTop"), 0)
        dialog.get_by_role("button", name="Предложить идею").click()
        expect(dialog.get_by_role("textbox", name="Сообщение")).to_be_visible()
        self.page.keyboard.press("Escape")
        expect(dialog).to_be_hidden()
        expect(menu).to_be_focused()

    def test_enter_after_typing_does_not_open_previous_search_result(self):
        self.page.goto(self.base + "?q=DEX")
        search = self.page.locator("#material-search")
        results = self.page.locator("#search-results a")
        expect(self.page.locator("#search-results a[href='#java-languages']")).to_be_visible()
        search.evaluate("""input => {
            input.value = 'транзакция';
            input.dispatchEvent(new Event('input', {bubbles: true}));
            input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Enter', bubbles: true}));
        }""")
        expect(self.page).to_have_url(self.base + "?q=DEX")
        expect(results.first).to_be_visible()
        self.assertIn("#05", results.evaluate_all("links => links.map(link => link.hash)"))

    def test_escape_cancels_scheduled_search(self):
        self.page.goto(self.base)
        search = self.page.locator("#material-search")
        search.focus()
        self.page.clock.install()
        search.evaluate("""input => {
            input.value = 'DEX';
            input.dispatchEvent(new Event('input', {bubbles: true}));
            input.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
        }""")
        self.page.clock.fast_forward(200)
        expect(self.page.locator("#search-panel")).to_be_hidden()

    def test_practice_works_with_browser_storage_blocked(self):
        errors = []
        self.page.on("pageerror", lambda error: errors.append(str(error)))
        self.page.add_init_script("""for (const key of ['localStorage', 'sessionStorage']) {
            Object.defineProperty(window, key, {get() {throw new DOMException('Blocked', 'SecurityError')}});
        }""")
        self.page.goto(self.base + "practice.html")
        self.page.locator("#run-btn").click()
        expect(self.page.locator("#result-table tbody tr")).to_have_count(3)
        self.page.locator(".q-opt[data-correct=true]").first.click()
        expect(self.page.locator("#progress-label")).to_have_text("Прогресс урока: 2 / 3")
        for command in ["sqlite3 --version", "sqlite3 college.db", ".databases", ".quit"]:
            self.page.locator("#command").fill(command)
            self.page.locator("#command").press("Enter")
        expect(self.page.locator("#command")).to_have_value("")
        self.assertEqual(errors, [])

    def test_practice_displays_all_result_sets(self):
        self.page.goto(self.base + "practice.html")
        self.page.locator("#sql-input").fill("SELECT 11 AS first; SELECT 22 AS second;")
        self.page.locator("#run-btn").click()
        tables = self.page.locator("#result-wrap table")
        expect(tables).to_have_count(2)
        expect(tables.nth(0).locator("tbody td").last).to_have_text("11")
        expect(tables.nth(1).locator("tbody td").last).to_have_text("22")

    def test_reader_preserves_position_inside_sql_lecture(self):
        self.page.goto(self.base + "#04")
        lecture = self.page.frame_locator("#frame")
        panel = lecture.locator("#panel-04")
        expect(panel).to_be_visible()
        panel.evaluate("element => element.scrollTop = 400")
        self.assertEqual(panel.evaluate("element => element.scrollTop"), 400)
        self.page.locator("#next-material").click()
        expect(lecture.locator("#panel-05")).to_be_visible()
        expect(self.page.locator("#reader-status")).to_be_hidden()
        self.page.locator("#previous-material").click()
        expect(panel).to_be_visible()
        self.page.reload()
        expect(panel).to_be_visible()
        expect(panel).to_have_js_property("scrollTop", 400)

    def test_standalone_sql_lecture_preserves_position(self):
        self.page.goto(self.base + "lectures/course.html#04")
        panel = self.page.locator("#panel-04")
        expect(panel).to_be_visible()
        panel.evaluate("element => element.scrollTop = 400")
        self.page.reload()
        expect(panel).to_have_js_property("scrollTop", 400)

    def test_setup_overview_fits_narrow_screens(self):
        self.page.goto(self.base + "lectures/setup.html")
        for width in (320, 390):
            with self.subTest(width=width):
                self.page.set_viewport_size({"width": width, "height": 844})
                self.assertEqual(self.page.evaluate("document.documentElement.scrollWidth"), width)

    def test_java_inline_code_wraps_on_narrow_screens(self):
        self.page.set_viewport_size({"width": 320, "height": 844})
        for path in ("java/arrays.html", "java/work-pr05.html"):
            with self.subTest(path=path):
                self.page.goto(self.base + path)
                self.assertEqual(self.page.evaluate("document.documentElement.scrollWidth"), 320)


if __name__ == "__main__":
    main(verbosity=2)
