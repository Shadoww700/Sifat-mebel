"""API regressions against real URL routing. Failures must not be hidden as xfails.

Run: DEBUG=False ../.venv/bin/python -B manage.py test catalog accounts --noinput
Requires an approved isolated PostgreSQL test database; never use the working DB.
"""

from datetime import timedelta
from decimal import Decimal
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APITestCase

from catalog import models
from catalog.test_helpers import (
    API, HIDDEN_REASONS, CatalogFixtureMixin, hide_product, make_product, make_variant, rows,
)


class ManagementPermissionAuditTests(CatalogFixtureMixin, APITestCase):
    def test_guest_customer_manager_cannot_mutate_any_catalog_resource(self):
        paths = (
            ("categories/", f"categories/{self.product.product_type.category_id}/"),
            ("brands/", f"brands/{self.product.brand_id}/"),
            ("product-types/", f"product-types/{self.product.product_type_id}/"),
            ("products/", f"product/{self.product.pk}/"),
            ("product-image", "product-image/999999/"),
            ("attributes/", "attributes/999999/"),
            ("product-type-attributes/", "product-type-attributes/999999/"),
            ("product-attribute-values/", "product-attribute-values/999999/"),
            ("product-variants/", f"product-variants/{self.variant.pk}/"),
            ("variant-attribute-values/", "variant-attribute-values/999999/"),
        )
        for user in (None, self.customer, self.manager):
            self.authenticate(user)
            for collection, detail in paths:
                for method, path in (("post", collection), ("patch", detail), ("delete", detail)):
                    with self.subTest(user=str(user), method=method, path=path):
                        response = getattr(self.client, method)(API + path, {}, format="json")
                        self.assertEqual(response.status_code, 401 if user is None else 403)
        self.product.refresh_from_db()
        self.variant.refresh_from_db()
        self.assertTrue(self.product.is_active)
        self.assertTrue(self.variant.is_active)
        self.assertEqual(models.Product.objects.count(), 1)
        self.assertFalse(models.StockMovement.objects.exists())

    def test_stock_history_and_adjustment_are_private(self):
        for user in (None, self.customer, self.manager):
            self.authenticate(user)
            expected = 401 if user is None else 403
            self.assertEqual(self.client.get(API + "stock/movements/").status_code, expected)
            self.assertEqual(self.client.post(API + "stock/adjust/", {
                "variant_id": self.variant.pk, "operation": "IN", "quantity": 2,
            }, format="json").status_code, expected)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 0)
        self.assertFalse(models.StockMovement.objects.exists())

    def test_admin_role_can_adjust_stock_like_other_admin_operations(self):
        # Policy regression: currently IsAdminUser disagrees with is_admin(role=ADMIN).
        self.authenticate(self.admin)
        response = self.client.post(API + "stock/adjust/", {
            "variant_id": self.variant.pk, "operation": "IN", "quantity": 2,
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 2)
        self.assertEqual(models.StockMovement.objects.get().quantity, 2)

    def test_staff_can_adjust_stock_and_admin_and_staff_can_read_history(self):
        self.authenticate(self.staff)
        response = self.client.post(API + "stock/adjust/", {
            "variant_id": self.variant.pk, "operation": "IN", "quantity": 3,
            "reason": "Audit shipment",
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        movement = models.StockMovement.objects.get(pk=response.data["id"])
        self.assertEqual((movement.variant_id, movement.quantity, movement.reason),
                         (self.variant.pk, 3, "Audit shipment"))
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 3)
        for user in (self.admin, self.staff):
            self.authenticate(user)
            self.assert_list_ids("stock/movements/", [movement.pk], variant_id=self.variant.pk)
            self.assert_list_ids("stock/movements/", [], variant_id=999999)

    def test_invalid_stock_history_variant_id_returns_400_not_500(self):
        self.authenticate(self.admin)
        response = self.client.get(API + "stock/movements/", {"variant_id": "abc"})
        self.assertEqual(response.status_code, 400)


class ProductVisibilityAuditTests(CatalogFixtureMixin, APITestCase):
    def test_detail_contains_the_correct_images_product_and_variant_attribute_values(self):
        image = models.ProductImage.objects.create(product=self.product, image="products/images/audit.jpg",
                                                    alt_text="Мебель", is_primary=True)
        attr = models.Attribute.objects.create(name="Материал", slug="material")
        models.ProductTypeAttribute.objects.create(product_type=self.product.product_type,
                                                   attribute=attr, can_be_variant_option=True)
        product_value = models.ProductAttributeValue.objects.create(product=self.product, attribute=attr, value_text="Дуб")
        variant_value = models.VariantAttributeValue.objects.create(variant=self.variant, attribute=attr, value_text="Орех")
        response = self.client.get(API + f"product/{self.product.pk}/")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual([row["id"] for row in response.data["images"]], [image.pk])
        self.assertEqual(response.data["images"][0]["alt_text"], "Мебель")
        self.assertTrue(response.data["images"][0]["image"].endswith("/products/images/audit.jpg"))
        self.assertEqual(response.data["attribute_values"][0]["id"], product_value.pk)
        self.assertEqual(response.data["attribute_values"][0]["attribute_info"]["name"], "Материал")
        self.assertEqual(response.data["attribute_values"][0]["value_text"], "Дуб")
        self.assertEqual(response.data["variants"][0]["id"], self.variant.pk)
        nested = response.data["variants"][0]["attribute_values"][0]
        self.assertEqual((nested["id"], nested["value_text"]), (variant_value.pk, "Орех"))

    def test_hidden_product_ids_cannot_be_opened_or_discovered_by_public_users(self):
        hidden = [(reason, make_product()) for reason in HIDDEN_REASONS]
        for reason, product in hidden:
            hide_product(product, reason)
        for user in (None, self.customer):
            self.authenticate(user)
            for reason, product in hidden:
                with self.subTest(user=str(user), reason=reason):
                    response = self.client.get(API + f"product/{product.pk}/")
                    self.assertEqual(response.status_code, 404)
                    self.assert_list_ids("products/", [], search=product.name,
                                         brand_id=product.brand_id, ordering="-base_price")

    def test_admin_and_staff_see_hidden_products_by_list_and_id(self):
        hidden = []
        for reason in HIDDEN_REASONS:
            product = make_product()
            hide_product(product, reason)
            hidden.append(product)
        for user in (self.admin, self.staff):
            self.authenticate(user)
            self.assert_list_ids("products/", [self.product.pk] + [p.pk for p in hidden])
            for product in hidden:
                self.assertEqual(self.client.get(API + f"product/{product.pk}/").status_code, 200)

    def test_out_of_stock_is_public_and_has_real_detail_serializer(self):
        self.product.status = models.ProductStatus.OUT_OF_STOCK
        self.product.save(update_fields=["status"])
        self.assert_list_ids("products/", [self.product.pk])
        response = self.client.get(API + f"product/{self.product.pk}/")
        self.assertEqual(response.status_code, 200)
        for field in ("images", "attribute_values", "variants", "brand_info", "product_type_info"):
            self.assertIn(field, response.data)

    def test_inactive_variant_hidden_from_both_direct_endpoint_and_nested_detail(self):
        inactive = make_variant(self.product, is_active=False)
        for user in (None, self.customer, self.admin, self.staff):
            self.authenticate(user)
            privileged = user in (self.admin, self.staff)
            expected = [self.variant.pk, inactive.pk] if privileged else [self.variant.pk]
            self.assert_list_ids("product-variants/", expected)
            response = self.client.get(API + f"product/{self.product.pk}/")
            self.assertEqual(response.status_code, 200)
            self.assertCountEqual([v["id"] for v in response.data["variants"]], expected)
            self.assertEqual(self.client.get(API + f"product-variants/{inactive.pk}/").status_code,
                             200 if privileged else 404)


class ProductWriteAuditTests(CatalogFixtureMixin, APITestCase):
    def payload(self, suffix="new", **overrides):
        data = dict(product_type=self.product.product_type_id, brand=self.product.brand_id,
                    name="Новый диван", slug=f"new-sofa-{suffix}", sku=f"NEW-{suffix}",
                    short_description="Описание", description="Полное описание", base_price="200.00",
                    discount_price="150.00", status="ACTIVE")
        data.update(overrides)
        return data

    def test_admin_and_staff_create_and_update_product_ignore_read_only_fields(self):
        for user in (self.admin, self.staff):
            self.authenticate(user)
            response = self.client.post(API + "products/", self.payload(str(user.pk), views_count=999,
                                        published_at="2000-01-01T00:00:00Z"), format="json")
            self.assertEqual(response.status_code, 201, response.data)
            product = models.Product.objects.get(pk=response.data["id"])
            self.assertEqual(product.views_count, 0)
            self.assertIsNotNone(product.published_at)
            self.assertGreater(product.published_at, timezone.now() - timedelta(minutes=1))
            response = self.client.patch(API + f"product/{product.pk}/", {
                "name": "Изменённый диван", "base_price": "180.00",
            }, format="json")
            self.assertEqual(response.status_code, 200, response.data)
            product.refresh_from_db()
            self.assertEqual((product.name, product.base_price), ("Изменённый диван", Decimal("180")))

    def test_partial_price_update_checks_existing_discount(self):
        self.authenticate(self.admin)
        models.Product.objects.filter(pk=self.product.pk).update(discount_price="80.00")
        response = self.client.patch(API + f"product/{self.product.pk}/", {"base_price": "70.00"}, format="json")
        self.assertEqual(response.status_code, 400, response.data)
        self.product.refresh_from_db()
        self.assertEqual(self.product.base_price, Decimal("100"))

    def test_invalid_prices_and_duplicate_sku_or_slug_do_not_create_products(self):
        self.authenticate(self.admin)
        for changes in ({"base_price": "-1"}, {"discount_price": "-1"}, {"discount_price": "201"},
                        {"base_price": "abc"}, {"base_price": "1.001"}, {"base_price": "100000000"},
                        {"sku": self.product.sku}, {"slug": self.product.slug}):
            with self.subTest(changes=changes):
                response = self.client.post(API + "products/", self.payload(**changes), format="json")
                self.assertEqual(response.status_code, 400, response.data)
                self.assertEqual(models.Product.objects.count(), 1)

    def test_delete_archives_product_and_keeps_variants_and_stock_history(self):
        from catalog.services import adjust_stock
        movement = adjust_stock(variant_id=self.variant.pk, operation="IN", quantity=2)
        self.authenticate(self.admin)
        response = self.client.delete(API + f"product/{self.product.pk}/")
        self.assertEqual(response.status_code, 204)
        self.product.refresh_from_db()
        self.assertFalse(self.product.is_active)
        self.assertEqual(self.product.status, models.ProductStatus.ARCHIVED)
        self.assertTrue(models.ProductVariant.objects.filter(pk=self.variant.pk).exists())
        self.assertTrue(models.StockMovement.objects.filter(pk=movement.pk).exists())

    def test_variant_create_and_patch_cannot_write_stock(self):
        self.authenticate(self.admin)
        response = self.client.post(API + "product-variants/", {
            "product": self.product.pk, "name": "Новый вариант", "sku": "NEW-VARIANT",
            "price": "120", "stock_quantity": 100,
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        variant = models.ProductVariant.objects.get(pk=response.data["id"])
        self.assertEqual(variant.stock_quantity, 0)
        response = self.client.patch(API + f"product-variants/{variant.pk}/", {
            "stock_quantity": 200, "name": "Изменённый вариант",
        }, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        variant.refresh_from_db()
        self.assertEqual(variant.stock_quantity, 0)
        self.assertEqual(variant.name, "Изменённый вариант")
        self.assertFalse(models.StockMovement.objects.exists())

    def test_variant_validation_rejects_bad_prices_duplicate_sku_and_partial_discount(self):
        self.authenticate(self.admin)
        for changes in ({"price": "-1"}, {"discount_price": "-1"}, {"discount_price": "101"},
                        {"sku": self.variant.sku}):
            payload = {"product": self.product.pk, "sku": "VALID-SKU", "name": "Valid", "price": "100"}
            payload.update(changes)
            response = self.client.post(API + "product-variants/", payload, format="json")
            self.assertEqual(response.status_code, 400, response.data)
        models.ProductVariant.objects.filter(pk=self.variant.pk).update(discount_price="80")
        response = self.client.patch(API + f"product-variants/{self.variant.pk}/", {"price": "70"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.price, Decimal("100"))
        self.assertEqual(models.ProductVariant.objects.count(), 1)


class SearchFilterAuditTests(CatalogFixtureMixin, APITestCase):
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        cls.product.name = "Янтарный диван"
        cls.product.short_description = "Бархатная обивка"
        cls.product.save(update_fields=["name", "short_description"])
        cls.product.brand.name = "Walnut Atelier"
        cls.product.brand.save(update_fields=["name"])
        cls.product.product_type.name = "Editorial Sofas"
        cls.product.product_type.save(update_fields=["name"])
        cls.expensive = make_product(base_price="300", name="Стол")
        cls.cheap = make_product(base_price="50", name="Стул")
        now = timezone.now()
        for index, product in enumerate((cls.cheap, cls.product, cls.expensive)):
            models.Product.objects.filter(pk=product.pk).update(created_at=now + timedelta(seconds=index))

    def test_search_matches_name_short_description_brand_and_product_type(self):
        for term in ("Янтарный", "Бархатная", "Walnut", "Editorial", "янтарный"):
            with self.subTest(term=term):
                self.assert_list_ids("products/", [self.product.pk], search=term)

    def test_combined_filters_and_inclusive_price_boundaries(self):
        self.assert_list_ids("products/", [self.product.pk], brand_id=self.product.brand_id,
                             category_id=self.product.product_type.category_id, min_price="100", max_price="100",
                             search="диван", ordering="base_price")
        self.assert_list_ids("products/", [], brand_id=self.product.brand_id,
                             category_id=self.cheap.product_type.category_id)
        self.assert_list_ids("products/", [self.product.pk, self.expensive.pk], min_price="100")
        self.assert_list_ids("products/", [self.product.pk, self.cheap.pk], max_price="100")

    def test_supported_ordering_and_default_creation_order(self):
        for ordering, expected in (
            ("base_price", [self.cheap.pk, self.product.pk, self.expensive.pk]),
            ("-base_price", [self.expensive.pk, self.product.pk, self.cheap.pk]),
            ("created_at", [self.cheap.pk, self.product.pk, self.expensive.pk]),
            ("-created_at", [self.expensive.pk, self.product.pk, self.cheap.pk]),
        ):
            response = self.client.get(API + "products/", {"ordering": ordering})
            self.assertEqual(response.status_code, 200)
            self.assertEqual([r["id"] for r in rows(response)], expected)
        response = self.client.get(API + "products/")
        self.assertEqual([r["id"] for r in rows(response)], [self.expensive.pk, self.product.pk, self.cheap.pk])

    def test_invalid_filter_numbers_and_ids_return_400(self):
        for params in ({"min_price": "abc"}, {"max_price": "abc"}, {"brand_id": "abc"},
                       {"category_id": "abc"}, {"brand_id": "999999"}, {"category_id": "999999"}):
            with self.subTest(params=params):
                self.assertEqual(self.client.get(API + "products/", params).status_code, 400)

    def test_negative_and_inverted_ranges_currently_return_empty_or_bounded_results(self):
        # Characterization, not a new requirement to reject valid numeric query syntax.
        self.assert_list_ids("products/", [self.product.pk, self.cheap.pk, self.expensive.pk], min_price="-10")
        self.assert_list_ids("products/", [], max_price="-1")
        self.assert_list_ids("products/", [], min_price="300", max_price="50")

    def test_base_price_filter_is_not_variant_price_filter(self):
        models.ProductVariant.objects.filter(pk=self.variant.pk).update(price="999")
        self.assert_list_ids("products/", [self.product.pk], min_price="100", max_price="100")
        self.assert_list_ids("products/", [], min_price="999", max_price="999")

    def test_invalid_ordering_cannot_inject_sql_or_order_by_private_field(self):
        response = self.client.get(API + "products/", {"ordering": "sku; DROP TABLE catalog_product"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(models.Product.objects.count(), 3)


class FavoriteAuditTests(CatalogFixtureMixin, APITestCase):
    def test_guest_cannot_read_add_retrieve_or_delete_favorites(self):
        favorite = models.Favorite.objects.create(user=self.customer, product=self.product)
        for method, path, payload in (("get", "favorites/", {}), ("post", "favorites/", {"product": self.product.pk}),
                                      ("get", f"favorites/{favorite.pk}/", {}),
                                      ("delete", f"favorites/{favorite.pk}/", {})):
            response = getattr(self.client, method)(API + path, payload, format="json")
            self.assertEqual(response.status_code, 401)
        self.assertEqual(models.Favorite.objects.count(), 1)

    def test_first_post_201_repeat_200_and_hidden_user_cannot_be_spoofed(self):
        self.authenticate(self.customer)
        payload = {"product": self.product.pk, "user": self.other.pk}
        first = self.client.post(API + "favorites/", payload, format="json")
        second = self.client.post(API + "favorites/", payload, format="json")
        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(second.status_code, 200, second.data)
        self.assertEqual(first.data["id"], second.data["id"])
        favorite = models.Favorite.objects.get()
        self.assertEqual((favorite.user_id, favorite.product_id), (self.customer.pk, self.product.pk))
        self.assertNotIn("user", first.data)

    def test_personal_list_detail_and_delete_cannot_access_another_users_favorite(self):
        own = models.Favorite.objects.create(user=self.customer, product=self.product)
        foreign = models.Favorite.objects.create(user=self.other, product=self.product)
        self.authenticate(self.customer)
        self.assert_list_ids("favorites/", [own.pk])
        for method in ("get", "delete"):
            self.assertEqual(getattr(self.client, method)(API + f"favorites/{foreign.pk}/").status_code, 404)
        self.assertEqual(self.client.get(API + f"favorites/{own.pk}/").status_code, 200)
        self.assertEqual(self.client.delete(API + f"favorites/{own.pk}/").status_code, 204)
        self.assertFalse(models.Favorite.objects.filter(pk=own.pk).exists())
        self.assertTrue(models.Favorite.objects.filter(pk=foreign.pk).exists())

    def test_even_admin_is_not_owner_of_another_users_favorite(self):
        favorite = models.Favorite.objects.create(user=self.customer, product=self.product)
        self.authenticate(self.admin)
        for method in ("get", "delete"):
            self.assertEqual(getattr(self.client, method)(API + f"favorites/{favorite.pk}/").status_code, 403)
        self.assertTrue(models.Favorite.objects.filter(pk=favorite.pk).exists())

    def test_missing_bad_and_nonexistent_product_rejected_without_rows(self):
        self.authenticate(self.customer)
        for payload in ({}, {"product": "abc"}, {"product": None}, {"product": 999999}, {"product_id": self.product.pk}):
            response = self.client.post(API + "favorites/", payload, format="json")
            self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(models.Favorite.objects.exists())

    def test_all_hidden_conditions_rejected_for_customer_but_admin_can_save(self):
        for reason in HIDDEN_REASONS:
            product = make_product()
            hide_product(product, reason)
            self.authenticate(self.customer)
            response = self.client.post(API + "favorites/", {"product": product.pk}, format="json")
            self.assertEqual(response.status_code, 400, (reason, response.data))
            self.assertFalse(models.Favorite.objects.filter(user=self.customer, product=product).exists())
            self.authenticate(self.admin)
            self.assertEqual(self.client.post(API + "favorites/", {"product": product.pk}, format="json").status_code, 201)

    def test_archived_saved_product_remains_removable_without_embedded_private_data(self):
        favorite = models.Favorite.objects.create(user=self.customer, product=self.product)
        self.product.archive()
        self.authenticate(self.customer)
        response = self.assert_list_ids("favorites/", [favorite.pk])
        self.assertEqual(set(rows(response)[0]), {"id", "product", "created_at"})
        self.assertEqual(rows(response)[0]["product"], self.product.pk)
        self.assertEqual(self.client.get(API + f"product/{self.product.pk}/").status_code, 404)
        self.assertEqual(self.client.delete(API + f"favorites/{favorite.pk}/").status_code, 204)
        self.assertFalse(models.Favorite.objects.filter(pk=favorite.pk).exists())


class RelatedVisibilityAuditTests(CatalogFixtureMixin, APITestCase):
    def test_inactive_brands_and_categories_are_hidden_in_public_list_and_detail(self):
        brand = models.Brand.objects.create(name="Hidden", slug="hidden", is_active=False)
        category = models.Category.objects.create(name="Hidden", slug="hidden", is_active=False)
        for user in (None, self.customer):
            self.authenticate(user)
            for resource, instance in (("brands", brand), ("categories", category)):
                response = self.client.get(API + f"{resource}/")
                self.assertEqual(response.status_code, 200)
                self.assertNotIn(instance.pk, [r["id"] for r in rows(response)])
                self.assertEqual(self.client.get(API + f"{resource}/{instance.pk}/").status_code, 404)

    def test_admin_can_read_inactive_categories_as_well_as_brands(self):
        # Regression: Category GET currently ignores the privileged role.
        self.authenticate(self.admin)
        category = models.Category.objects.create(name="Hidden", slug="hidden", is_active=False)
        response = self.client.get(API + f"categories/{category.pk}/")
        self.assertEqual(response.status_code, 200)
        response = self.client.get(API + "categories/")
        self.assertIn(category.pk, [r["id"] for r in rows(response)])

    def test_product_type_and_schema_cannot_reveal_disabled_category(self):
        attr = models.Attribute.objects.create(name="Material", slug="material")
        schema = models.ProductTypeAttribute.objects.create(product_type=self.product.product_type, attribute=attr)
        hide_product(self.product, "category")
        for path, pk in (("product-types/", self.product.product_type_id), ("product-type-attributes/", schema.pk)):
            with self.subTest(resource=path):
                self.assert_list_ids(path, [])
                self.assertEqual(self.client.get(API + f"{path}{pk}/").status_code, 404)

    def test_related_resources_never_expose_a_product_hidden_by_parent_relations(self):
        for reason in ("brand", "type", "category"):
            product = make_product()
            variant = make_variant(product)
            attr = models.Attribute.objects.create(name=reason, slug=reason)
            image = models.ProductImage.objects.create(product=product, image="products/images/audit.jpg")
            pvalue = models.ProductAttributeValue.objects.create(product=product, attribute=attr, value_text="Private")
            vvalue = models.VariantAttributeValue.objects.create(variant=variant, attribute=attr, value_text="Private")
            hide_product(product, reason)
            for resource, collection, pk in (
                ("product-image", "product-image", image.pk),
                ("product-attribute-values", "product-attribute-values/", pvalue.pk),
                ("variant-attribute-values", "variant-attribute-values/", vvalue.pk),
                ("product-variants", "product-variants/", variant.pk),
            ):
                with self.subTest(reason=reason, resource=resource):
                    response = self.client.get(API + collection)
                    self.assertEqual(response.status_code, 200)
                    self.assertNotIn(pk, [r["id"] for r in rows(response)])
                    self.assertEqual(self.client.get(API + f"{resource}/{pk}/").status_code, 404)


class CatalogQueryAuditTests(CatalogFixtureMixin, APITestCase):
    def test_list_query_count_is_constant_as_product_count_grows(self):
        self.client.get(API + "products/")  # Warm up framework routing/serializer setup.
        with CaptureQueriesContext(connection) as small:
            self.assertEqual(self.client.get(API + "products/").status_code, 200)
        for _ in range(5):
            make_product()
        with CaptureQueriesContext(connection) as large:
            self.assertEqual(self.client.get(API + "products/").status_code, 200)
        self.assertLessEqual(len(large), len(small) + 1, [q["sql"] for q in large])

    def test_detail_query_count_does_not_grow_per_nested_attribute(self):
        def add_attribute(index):
            attr = models.Attribute.objects.create(name=f"Attr {index}", slug=f"attr-{index}")
            models.ProductTypeAttribute.objects.create(product_type=self.product.product_type, attribute=attr, can_be_variant_option=True)
            models.ProductAttributeValue.objects.create(product=self.product, attribute=attr, value_text="Oak")
            models.VariantAttributeValue.objects.create(variant=self.variant, attribute=attr, value_text="Oak")
        add_attribute(0)
        path = API + f"product/{self.product.pk}/"
        self.client.get(path)
        with CaptureQueriesContext(connection) as small:
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200)
        for index in range(1, 6):
            add_attribute(index)
        with CaptureQueriesContext(connection) as large:
            response = self.client.get(path)
            self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data["attribute_values"]), 6)
        self.assertEqual(len(response.data["variants"][0]["attribute_values"]), 6)
        self.assertLessEqual(len(large), len(small) + 1,
                             "Nested serializers must not query Attribute separately for each value")
