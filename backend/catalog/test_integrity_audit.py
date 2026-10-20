"""Typed attributes, PostgreSQL constraints and warehouse transaction regressions."""

from decimal import Decimal
from unittest.mock import patch

from django.db import IntegrityError, transaction
from django.test import SimpleTestCase, TestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APITestCase

from catalog import models
from catalog.serializers import StockAdjustmentSerializer
from catalog.services import adjust_stock
from catalog.test_helpers import API, CatalogFixtureMixin, make_product, make_variant


class StockInputUnitAuditTests(SimpleTestCase):
    def test_stock_input_rejects_invalid_ids_operations_and_non_positive_or_fractional_quantities(self):
        for changes in ({"variant_id": 0}, {"quantity": 0}, {"quantity": -1},
                        {"quantity": "abc"}, {"quantity": "1.5"}, {"operation": "INVALID"}):
            with self.subTest(changes=changes):
                serializer = StockAdjustmentSerializer(data={
                    "variant_id": 1, "operation": "IN", "quantity": 1, **changes,
                })
                self.assertFalse(serializer.is_valid())
        valid = StockAdjustmentSerializer(data={"variant_id": 1, "operation": "IN", "quantity": 1})
        self.assertTrue(valid.is_valid(), valid.errors)
        self.assertEqual(valid.validated_data["reason"], "")

    def test_stock_reason_length_is_validated_before_reaching_postgresql(self):
        limit = models.StockMovement._meta.get_field("reason").max_length
        serializer = StockAdjustmentSerializer(data={
            "variant_id": 1, "operation": "IN", "quantity": 1, "reason": "x" * (limit + 1),
        })
        self.assertFalse(serializer.is_valid(), "Overlong reason must be a 400 validation error, not a database error")
        self.assertIn("reason", serializer.errors)


class AttributeValueAuditTests(CatalogFixtureMixin, APITestCase):
    def setUp(self):
        self.authenticate(self.admin)

    def test_text_number_zero_and_boolean_false_round_trip_for_product_and_variant(self):
        for kind, field, value in (("TEXT", "value_text", "Массив дуба"),
                                   ("NUMBER", "value_number", "0.00"),
                                   ("BOOLEAN", "value_boolean", False)):
            attr = models.Attribute.objects.create(name=kind, slug=kind.lower(), data_type=kind)
            models.ProductTypeAttribute.objects.create(product_type=self.product.product_type,
                                                       attribute=attr, can_be_variant_option=True)
            for resource, model, owner, owner_id in (
                ("product-attribute-values", models.ProductAttributeValue, "product", self.product.pk),
                ("variant-attribute-values", models.VariantAttributeValue, "variant", self.variant.pk),
            ):
                with self.subTest(kind=kind, resource=resource):
                    payload = {owner: owner_id, "attribute": attr.pk, field: value}
                    response = self.client.post(API + resource + "/", payload, format="json")
                    self.assertEqual(response.status_code, 201, response.data)
                    row = model.objects.get(pk=response.data["id"])
                    self.assertEqual(getattr(row, field), Decimal("0") if kind == "NUMBER" else value)
                    for other in {"value_text", "value_number", "value_boolean"} - {field}:
                        self.assertIsNone(getattr(row, other))
                    duplicate = self.client.post(API + resource + "/", payload, format="json")
                    self.assertEqual(duplicate.status_code, 400, duplicate.data)
                    response = self.client.patch(API + f"{resource}/{row.pk}/", {field: value}, format="json")
                    self.assertEqual(response.status_code, 200, response.data)
                    self.assertEqual(model.objects.filter(**{owner: owner_id}, attribute=attr).count(), 1)

    def test_type_schema_binding_and_variant_option_flag_are_enforced(self):
        attr = models.Attribute.objects.create(name="Material", slug="material")
        payload = {"attribute": attr.pk, "value_text": "Oak"}
        for resource, owner, owner_id in (("product-attribute-values", "product", self.product.pk),
                                          ("variant-attribute-values", "variant", self.variant.pk)):
            response = self.client.post(API + resource + "/", {**payload, owner: owner_id}, format="json")
            self.assertEqual(response.status_code, 400, response.data)
        link = models.ProductTypeAttribute.objects.create(product_type=self.product.product_type, attribute=attr)
        response = self.client.post(API + "variant-attribute-values/", {**payload, "variant": self.variant.pk}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(models.VariantAttributeValue.objects.exists())
        link.can_be_variant_option = True
        link.save(update_fields=["can_be_variant_option"])
        response = self.client.post(API + "variant-attribute-values/", {**payload, "variant": self.variant.pk}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(models.VariantAttributeValue.objects.get().value_text, "Oak")

    def test_mixed_and_missing_typed_values_are_rejected(self):
        for kind in ("TEXT", "NUMBER", "BOOLEAN"):
            attr = models.Attribute.objects.create(name=kind, slug=kind.lower(), data_type=kind)
            models.ProductTypeAttribute.objects.create(product_type=self.product.product_type,
                                                       attribute=attr, can_be_variant_option=True)
            for resource, owner, owner_id in (("product-attribute-values", "product", self.product.pk),
                                              ("variant-attribute-values", "variant", self.variant.pk)):
                for values in ({}, {"value_text": "Oak", "value_number": "10", "value_boolean": False}):
                    with self.subTest(kind=kind, resource=resource, values=values):
                        response = self.client.post(API + resource + "/", {
                            owner: owner_id, "attribute": attr.pk, **values,
                        }, format="json")
                        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(models.ProductAttributeValue.objects.exists())
        self.assertFalse(models.VariantAttributeValue.objects.exists())

    def test_variant_empty_text_is_rejected(self):
        attr = models.Attribute.objects.create(name="Material", slug="material")
        models.ProductTypeAttribute.objects.create(product_type=self.product.product_type,
                                                   attribute=attr, can_be_variant_option=True)
        response = self.client.post(API + "variant-attribute-values/", {
            "variant": self.variant.pk, "attribute": attr.pk, "value_text": "  ",
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(models.VariantAttributeValue.objects.exists())

    def test_schema_for_another_product_type_does_not_authorize_attribute(self):
        other_product = make_product()
        attr = models.Attribute.objects.create(name="Other", slug="other")
        models.ProductTypeAttribute.objects.create(product_type=other_product.product_type,
                                                   attribute=attr, can_be_variant_option=True)
        response = self.client.post(API + "product-attribute-values/", {
            "product": self.product.pk, "attribute": attr.pk, "value_text": "Oak",
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(models.ProductAttributeValue.objects.exists())


class DatabaseConstraintAuditTests(CatalogFixtureMixin, TestCase):
    def assert_integrity_error(self, operation):
        # Catch outside a nested savepoint so the enclosing TestCase transaction stays usable.
        with self.assertRaises(IntegrityError), transaction.atomic():
            operation()

    def test_product_price_constraints_cannot_be_bypassed_by_queryset_update(self):
        for values in ({"base_price": -1}, {"discount_price": -1}, {"discount_price": 101}):
            with self.subTest(values=values):
                self.assert_integrity_error(lambda: models.Product.objects.filter(pk=self.product.pk).update(**values))
        self.product.refresh_from_db()
        self.assertEqual(self.product.base_price, Decimal("100"))
        self.assertIsNone(self.product.discount_price)

    def test_variant_price_and_stock_constraints_apply_without_serializer(self):
        for values in ({"price": -1}, {"discount_price": -1}, {"discount_price": 101}, {"stock_quantity": -1}):
            with self.subTest(values=values):
                self.assert_integrity_error(lambda: models.ProductVariant.objects.filter(pk=self.variant.pk).update(**values))
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 0)
        self.assertEqual(self.variant.price, Decimal("100"))

    def test_product_and_variant_sku_and_product_slug_unique_in_database(self):
        other = make_product()
        variant = make_variant(other)
        for model, pk, values in ((models.Product, other.pk, {"sku": self.product.sku}),
                                  (models.Product, other.pk, {"slug": self.product.slug}),
                                  (models.ProductVariant, variant.pk, {"sku": self.variant.sku})):
            self.assert_integrity_error(lambda: model.objects.filter(pk=pk).update(**values))

    def test_product_type_slug_is_unique_per_category_not_globally(self):
        self.assert_integrity_error(lambda: models.ProductType.objects.create(
            category=self.product.product_type.category, name="Duplicate", slug=self.product.product_type.slug,
        ))
        other = make_product()
        models.ProductType.objects.create(category=other.product_type.category,
                                         name="Allowed", slug=self.product.product_type.slug)

    def test_schema_and_typed_value_unique_constraints(self):
        attr = models.Attribute.objects.create(name="Material", slug="material")
        factories = (
            lambda: models.ProductTypeAttribute.objects.create(product_type=self.product.product_type, attribute=attr),
            lambda: models.ProductAttributeValue.objects.create(product=self.product, attribute=attr, value_text="Oak"),
            lambda: models.VariantAttributeValue.objects.create(variant=self.variant, attribute=attr, value_text="Oak"),
        )
        for factory in factories:
            factory()
            self.assert_integrity_error(factory)

    def test_only_one_primary_image_per_product(self):
        models.ProductImage.objects.create(product=self.product, image="audit/one.jpg", is_primary=True)
        self.assert_integrity_error(lambda: models.ProductImage.objects.create(
            product=self.product, image="audit/two.jpg", is_primary=True,
        ))
        models.ProductImage.objects.create(product=self.product, image="audit/three.jpg", is_primary=False)
        self.assertEqual(models.ProductImage.objects.filter(product=self.product).count(), 2)

    def test_favorite_pair_unique_but_same_product_for_different_users_allowed(self):
        models.Favorite.objects.create(user=self.customer, product=self.product)
        self.assert_integrity_error(lambda: models.Favorite.objects.create(user=self.customer, product=self.product))
        models.Favorite.objects.create(user=self.other, product=self.product)
        self.assertEqual(models.Favorite.objects.count(), 2)

    def test_stock_movement_quantity_must_be_positive(self):
        for quantity in (0, -1):
            self.assert_integrity_error(lambda: models.StockMovement.objects.create(
                variant=self.variant, quantity=quantity, operation="IN",
            ))
        self.assertFalse(models.StockMovement.objects.exists())


class StockServiceAuditTests(CatalogFixtureMixin, APITestCase):
    def test_in_and_out_return_persisted_movements_with_reasons(self):
        incoming = adjust_stock(variant_id=self.variant.pk, operation="IN", quantity=8, reason="Shipment")
        outgoing = adjust_stock(variant_id=self.variant.pk, operation="OUT", quantity=8, reason="Sold")
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 0)
        self.assertEqual((incoming.quantity, incoming.operation, incoming.reason), (8, "IN", "Shipment"))
        self.assertEqual((outgoing.quantity, outgoing.operation, outgoing.reason), (8, "OUT", "Sold"))
        self.assertEqual(models.StockMovement.objects.filter(variant=self.variant).count(), 2)

    def test_invalid_operation_quantities_and_oversell_leave_no_partial_changes(self):
        adjust_stock(variant_id=self.variant.pk, operation="IN", quantity=3)
        for operation, quantity in (("IN", 0), ("IN", -1), ("OUT", 0), ("OUT", -1),
                                     ("INVALID", 1), ("OUT", 4)):
            with self.subTest(operation=operation, quantity=quantity):
                with self.assertRaises(ValidationError):
                    adjust_stock(variant_id=self.variant.pk, operation=operation, quantity=quantity)
                self.variant.refresh_from_db()
                self.assertEqual(self.variant.stock_quantity, 3)
                self.assertEqual(models.StockMovement.objects.count(), 1)

    def test_movement_insert_failure_rolls_back_stock_update(self):
        with patch("catalog.services.StockMovement.objects.create", side_effect=IntegrityError("Audit insert failure")):
            with self.assertRaises(IntegrityError):
                adjust_stock(variant_id=self.variant.pk, operation="IN", quantity=5)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 0)
        self.assertFalse(models.StockMovement.objects.exists())

    def test_staff_api_validates_payload_and_returns_404_for_missing_variant(self):
        self.authenticate(self.staff)
        for changes in ({"quantity": 0}, {"quantity": -1}, {"quantity": "abc"},
                        {"operation": "INVALID"}, {"variant_id": -1}):
            payload = {"variant_id": self.variant.pk, "quantity": 1, "operation": "IN", **changes}
            response = self.client.post(API + "stock/adjust/", payload, format="json")
            self.assertEqual(response.status_code, 400, response.data)
        response = self.client.post(API + "stock/adjust/", {
            "variant_id": 999999, "quantity": 1, "operation": "IN",
        }, format="json")
        self.assertEqual(response.status_code, 404)
        self.assertFalse(models.StockMovement.objects.exists())
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 0)

    def test_deleting_used_variant_soft_disables_and_preserves_stock_and_history(self):
        movement = adjust_stock(variant_id=self.variant.pk, operation="IN", quantity=5)
        self.authenticate(self.admin)
        response = self.client.delete(API + f"product-variants/{self.variant.pk}/")
        self.assertEqual(response.status_code, 204)
        self.variant.refresh_from_db()
        self.assertFalse(self.variant.is_active)
        self.assertEqual(self.variant.stock_quantity, 5)
        self.assertTrue(models.StockMovement.objects.filter(pk=movement.pk, variant=self.variant).exists())

    def test_disabling_variant_does_not_adjust_stock(self):
        adjust_stock(variant_id=self.variant.pk, operation="IN", quantity=3)
        self.authenticate(self.admin)
        response = self.client.patch(API + f"product-variants/{self.variant.pk}/", {"is_active": False}, format="json")
        self.assertEqual(response.status_code, 200)
        self.variant.refresh_from_db()
        self.assertEqual(self.variant.stock_quantity, 3)
        self.assertFalse(self.variant.is_active)
        self.assertEqual(models.StockMovement.objects.count(), 1)
