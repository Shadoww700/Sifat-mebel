"""Real PostgreSQL concurrency, independent connections and committed fixtures.

No SQLite emulation, no sequential calls disguised as concurrency. PostgreSQL
must support row locks. These tests never connect directly to the working DB;
they use the database switched by Django's test runner.
"""

from concurrent.futures import ThreadPoolExecutor
from queue import Queue
from threading import Barrier
from time import monotonic, sleep

from django.contrib.auth import get_user_model
from django.db import close_old_connections, connection, connections, transaction
from django.test import TransactionTestCase, skipUnlessDBFeature
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIClient

from catalog import models
from catalog.services import adjust_stock
from catalog.test_helpers import API, make_product, make_variant


@skipUnlessDBFeature("has_select_for_update")
class PostgreSQLConcurrencyAuditTests(TransactionTestCase):
    def setUp(self):
        self.product = make_product()
        self.variant = make_variant(self.product)
        self.user = get_user_model().objects.create_user(email="concurrent@audit.test")

    def test_two_simultaneous_out_operations_cannot_oversell(self):
        adjust_stock(variant_id=self.variant.pk, operation="IN", quantity=5)
        barrier = Barrier(2, timeout=10)

        def withdraw():
            close_old_connections()
            try:
                barrier.wait()
                try:
                    movement = adjust_stock(variant_id=self.variant.pk, operation="OUT", quantity=4)
                    return ("ok", movement.pk)
                except ValidationError:
                    return ("insufficient", None)
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(withdraw) for _ in range(2)]
            results = [future.result(timeout=20) for future in futures]
        self.assertCountEqual([r[0] for r in results], ["ok", "insufficient"])
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 1)
        self.assertEqual(models.StockMovement.objects.filter(operation="OUT").count(), 1)

    def test_simultaneous_increments_do_not_lose_updates(self):
        barrier = Barrier(2, timeout=10)

        def deposit(quantity):
            close_old_connections()
            try:
                barrier.wait()
                return adjust_stock(variant_id=self.variant.pk, operation="IN", quantity=quantity).pk
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(deposit, value) for value in (3, 7)]
            movement_ids = [future.result(timeout=20) for future in futures]
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 10)
        self.assertEqual(models.StockMovement.objects.filter(pk__in=movement_ids).count(), 2)

    def test_service_really_waits_for_a_row_lock_on_another_connection(self):
        if connection.vendor != "postgresql":
            self.skipTest("pg_blocking_pids lock observation requires PostgreSQL")
        worker_pid = Queue()

        def deposit():
            close_old_connections()
            try:
                with connection.cursor() as cursor:
                    cursor.execute("SELECT pg_backend_pid()")
                    worker_pid.put(cursor.fetchone()[0])
                return adjust_stock(variant_id=self.variant.pk, operation="IN", quantity=2).pk
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=1) as pool:
            # Release the row in all cases, including assertion errors, before pool.join().
            with transaction.atomic():
                models.ProductVariant.objects.select_for_update().get(pk=self.variant.pk)
                future = pool.submit(deposit)
                pid = worker_pid.get(timeout=10)
                blocked = False
                deadline = monotonic() + 5
                while monotonic() < deadline:
                    with connection.cursor() as cursor:
                        cursor.execute("SELECT pg_backend_pid() = ANY(pg_blocking_pids(%s))", [pid])
                        row = cursor.fetchone()
                    if row and row[0]:
                        blocked = True
                        break
                    if future.done():
                        break
                    sleep(0.02)
                self.assertTrue(blocked, "Worker never waited for the held PostgreSQL row lock")
                self.assertFalse(future.done())
                self.assertEqual(models.StockMovement.objects.count(), 0)
            movement_id = future.result(timeout=10)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 2)
        self.assertTrue(models.StockMovement.objects.filter(pk=movement_id).exists())

    def test_concurrent_duplicate_favorite_posts_return_201_and_200_with_one_row(self):
        barrier = Barrier(2, timeout=10)

        def add_favorite():
            close_old_connections()
            try:
                client = APIClient()
                client.force_authenticate(user=get_user_model().objects.get(pk=self.user.pk))
                barrier.wait()
                response = client.post(API + "favorites/", {"product": self.product.pk}, format="json")
                return response.status_code, response.data["id"]
            finally:
                connections.close_all()

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(add_favorite) for _ in range(2)]
            results = [future.result(timeout=20) for future in futures]
        self.assertCountEqual([r[0] for r in results], [201, 200])
        self.assertEqual(results[0][1], results[1][1])
        favorite = models.Favorite.objects.get()
        self.assertEqual((favorite.user_id, favorite.product_id), (self.user.pk, self.product.pk))
