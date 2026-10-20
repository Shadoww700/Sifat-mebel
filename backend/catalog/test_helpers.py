"""Shared fixtures for the audit tests; only Django's isolated test DB is used."""

from itertools import count

from django.contrib.auth import get_user_model

from catalog import models


API = "/api/v1/catalog/"
_ids = count(1)


def make_product(**overrides):
    """Independent parents allow visibility tests to disable one relation at a time."""
    index = next(_ids)
    category = models.Category.objects.create(name=f"Category {index}", slug=f"category-{index}")
    brand = models.Brand.objects.create(name=f"Brand {index}", slug=f"brand-{index}")
    product_type = models.ProductType.objects.create(
        name=f"Type {index}", slug=f"type-{index}", category=category,
    )
    values = dict(
        name=f"Product {index}", slug=f"product-{index}", sku=f"PRODUCT-{index}",
        short_description="Comfortable furniture", description="Full description",
        product_type=product_type, brand=brand, base_price="100.00",
        status=models.ProductStatus.ACTIVE,
    )
    values.update(overrides)
    return models.Product.objects.create(**values)


def make_variant(product, **overrides):
    index = next(_ids)
    values = dict(product=product, sku=f"VARIANT-{index}", name=f"Variant {index}", price="100.00")
    values.update(overrides)
    return models.ProductVariant.objects.create(**values)


def hide_product(product, reason):
    if reason in ("DRAFT", "ARCHIVED"):
        models.Product.objects.filter(pk=product.pk).update(status=reason)
    elif reason == "product":
        models.Product.objects.filter(pk=product.pk).update(is_active=False)
    else:
        related = {
            "brand": product.brand,
            "type": product.product_type,
            "category": product.product_type.category,
        }[reason]
        type(related).objects.filter(pk=related.pk).update(is_active=False)


HIDDEN_REASONS = ("DRAFT", "ARCHIVED", "product", "brand", "type", "category")


def rows(response):
    data = response.data
    return data["results"] if isinstance(data, dict) else data


class CatalogFixtureMixin:
    @classmethod
    def setUpTestData(cls):
        super().setUpTestData()
        user_model = get_user_model()
        cls.customer = user_model.objects.create_user(email="customer@audit.test")
        cls.other = user_model.objects.create_user(email="other@audit.test")
        cls.admin = user_model.objects.create_user(email="admin@audit.test", role="ADMIN")
        cls.staff = user_model.objects.create_user(email="staff@audit.test", is_staff=True)
        cls.manager = user_model.objects.create_user(email="manager@audit.test", role="MANAGER")
        cls.product = make_product()
        cls.variant = make_variant(cls.product)

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def assert_list_ids(self, path, expected, **params):
        response = self.client.get(API + path, params)
        self.assertEqual(response.status_code, 200, response.data)
        self.assertCountEqual([row["id"] for row in rows(response)], expected)
        return response
