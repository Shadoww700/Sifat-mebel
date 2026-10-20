"""Page-scoped images and public/private read boundaries through real API views."""

from django.db import connection
from django.test import SimpleTestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APITestCase

from catalog import models
from catalog.serializers import ProductImageQuerySerializer
from catalog.test_helpers import (
    API, HIDDEN_REASONS, CatalogFixtureMixin, hide_product, make_product, make_variant, rows,
)


class ImageQueryValidationTests(SimpleTestCase):
    def test_valid_ids_are_bounded_and_deduplicated(self):
        query = ProductImageQuerySerializer(data={'product_ids': '3,1,3', 'product_id': '3'})
        self.assertTrue(query.is_valid(), query.errors)
        self.assertEqual(query.validated_data, {'product_ids': [3, 1], 'product_id': 3})

    def test_invalid_ids_never_fall_back_to_all_images(self):
        for value in ('', '1,', 'a', '0', '-1', '1.5', '١', '9' * 20, ','.join(['1'] * 101)):
            with self.subTest(value=value):
                self.assertFalse(ProductImageQuerySerializer(data={'product_ids': value}).is_valid())


class PageImageTests(CatalogFixtureMixin, APITestCase):
    def image(self, product):
        return models.ProductImage.objects.create(product=product, image='products/images/test.jpg')

    def test_images_only_belong_to_requested_product_page(self):
        for _ in range(24):
            self.image(make_product())
        page = self.client.get(API + 'products/', {'page': 2, 'page_size': 20})
        ids = [row['id'] for row in page.data['results']]
        response = self.client.get(API + 'product-image', {'product_ids': ','.join(map(str, ids))})
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data)
        self.assertTrue(all(row['product'] in ids for row in response.data))
        self.assertEqual(len(response.data), models.ProductImage.objects.filter(product_id__in=ids).count())

    def test_single_id_filter_and_nonexistent_id(self):
        image = self.image(self.product)
        self.image(make_product())
        self.assert_list_ids('product-image', [image.pk], product_id=self.product.pk)
        self.assert_list_ids('product-image', [], product_ids='9223372036854775807')
        for params in ({'product_ids': 'bad'}, {'product_ids': ''}, {'product_id': 'bad'}):
            self.assertEqual(self.client.get(API + 'product-image', params).status_code, 400)

    def test_filtered_images_do_not_bypass_public_visibility(self):
        for reason in HIDDEN_REASONS:
            product = make_product()
            image = self.image(product)
            hide_product(product, reason)
            for user in (None, self.customer, self.manager):
                self.authenticate(user)
                for params in ({'product_id': product.pk}, {'product_ids': str(product.pk), 'is_active': 'false'}):
                    self.assert_list_ids('product-image', [], **params)
                self.assertEqual(self.client.get(API + f'product-image/{image.pk}/').status_code, 404)
            for user in (self.admin, self.staff):
                self.authenticate(user)
                self.assert_list_ids('product-image', [image.pk], product_id=product.pk)
                self.assertEqual(self.client.get(API + f'product-image/{image.pk}/').status_code, 200)

    def test_image_query_count_does_not_grow_per_product(self):
        ids = [self.product.pk]
        self.image(self.product)
        self.client.get(API + 'product-image', {'product_ids': str(self.product.pk)})
        with CaptureQueriesContext(connection) as small:
            self.client.get(API + 'product-image', {'product_ids': str(self.product.pk)})
        for _ in range(19):
            product = make_product()
            ids.append(product.pk)
            self.image(product)
        with CaptureQueriesContext(connection) as large:
            response = self.client.get(API + 'product-image', {'product_ids': ','.join(map(str, ids))})
        self.assertEqual(len(response.data), 20)
        self.assertLessEqual(len(large), len(small))


class PrivateFavoriteTests(CatalogFixtureMixin, APITestCase):
    def test_all_roles_see_only_own_favorites_and_foreign_ids_are_not_discoverable(self):
        users = (self.customer, self.other, self.admin, self.staff, self.manager)
        favorites = [models.Favorite.objects.create(user=user, product=self.product) for user in users]
        for user, own in zip(users, favorites):
            self.authenticate(user)
            self.assert_list_ids('favorites/', [own.pk])
            self.assertEqual(self.client.get(API + f'favorites/{own.pk}/').status_code, 200)
            for foreign in favorites:
                if foreign.pk == own.pk:
                    continue
                for method in ('get', 'delete'):
                    self.assertEqual(getattr(self.client, method)(API + f'favorites/{foreign.pk}/').status_code, 404)
        self.assertEqual(models.Favorite.objects.count(), len(users))

    def test_inactive_variant_attribute_values_are_not_public(self):
        variant = make_variant(self.product, is_active=False)
        attribute = models.Attribute.objects.create(name='Hidden option', slug='hidden-option')
        value = models.VariantAttributeValue.objects.create(variant=variant, attribute=attribute, value_text='Private')
        for user in (None, self.customer):
            self.authenticate(user)
            self.assert_list_ids('variant-attribute-values/', [])
            self.assertEqual(self.client.get(API + f'variant-attribute-values/{value.pk}/').status_code, 404)
            detail = self.client.get(API + f'product/{self.product.pk}/')
            self.assertNotIn(variant.pk, [v['id'] for v in detail.data['variants']])
