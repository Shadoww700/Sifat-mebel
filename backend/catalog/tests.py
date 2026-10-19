from django.test import TestCase
from django.test import SimpleTestCase
from rest_framework.test import APIRequestFactory

from catalog import views


class FavoritePermissionTests(SimpleTestCase):

    def test_anonymous_cannot_add_favorite(self):
        factory = APIRequestFactory()

        request = factory.post(
            '/api/favorites/',
            {'product': 1},
            format='json'
        )
        response = views.FavoriteListCreateAPIView.as_view()(request)
        self.assertIn(response.status_code, [401, 403])

    def test_anonymous_cannot_create_product(self):
        factory = APIRequestFactory()

        request = factory.post(
            '/api/products/',
            {'name': 'Диван'},
            format='json'
        )
        response = views.ProductListCreateAPIView.as_view()(request)
        self.assertIn(response.status_code, [401, 403])

    def test_anonymous_cannot_adjust_stock(self):
        factory = APIRequestFactory()
        request = factory.post(
            '/api/stock/adjust/',
            {
                'variant_id': 1,
                'operation': 'IN',
                'quantity': 10
            },
            format='json'
        )
        response = views.StockAdjustAPIView.as_view()(request)
        self.assertIn(response.status_code, [401, 403])


from decimal import Decimal

from rest_framework.test import APITestCase, APIRequestFactory

from . import models
from .views import ProductListCreateAPIView
from .services import adjust_stock


class CatalogAndStockTests(APITestCase):

    def setUp(self):
        self.factory = APIRequestFactory()

        self.category = models.Category.objects.create(
            name='Мебель',
            slug='mebel'
        )

        self.brand = models.Brand.objects.create(
            name='Sifat Mebel',
            slug='sifat-mebel'
        )

        self.product_type = models.ProductType.objects.create(
            category=self.category,
            name='Диваны',
            slug='divany'
        )

        self.product = models.Product.objects.create(
            product_type=self.product_type,
            brand=self.brand,
            name='Диван Luxury',
            slug='divan-luxury',
            short_description='Мягкий диван',
            description='Тестовый диван',
            sku='PRODUCT-001',
            base_price=Decimal('3500.00'),
            status=models.ProductStatus.ACTIVE
        )

        self.variant = models.ProductVariant.objects.create(
            product=self.product,
            name='Красный',
            sku='VARIANT-001',
            price=Decimal('3500.00')
        )

    def get_products(self, **params):
        request = self.factory.get('/api/products/', data=params)

        response = ProductListCreateAPIView.as_view()(request)
        self.assertEqual(response.status_code, 200)

        data = response.data

        if isinstance(data, dict):
            return data['results']

        return data

    def test_public_product_visible(self):
        products = self.get_products()

        ids = [p['id'] for p in products]

        self.assertIn(self.product.id, ids)

    def test_draft_product_hidden(self):
        self.product.status = models.ProductStatus.DRAFT
        self.product.save(update_fields=['status'])

        products = self.get_products()

        self.assertEqual(len(products), 0)

    def test_inactive_brand_hidden(self):
        self.brand.is_active = False
        self.brand.save(update_fields=['is_active'])

        products = self.get_products()

        self.assertEqual(len(products), 0)

    def test_inactive_category_hidden(self):
        self.category.is_active = False
        self.category.save(update_fields=['is_active'])

        products = self.get_products()

        self.assertEqual(len(products), 0)

    def test_inactive_product_type_hidden(self):
        self.product_type.is_active = False
        self.product_type.save(update_fields=['is_active'])

        products = self.get_products()

        self.assertEqual(len(products), 0)

    def test_search_and_price(self):
        products = self.get_products(
            search='диван',
            min_price='3000',
            max_price='4000'
        )

        self.assertEqual(len(products), 1)
        self.assertEqual(products[0]['id'], self.product.id)

    def test_invalid_price_rejected(self):
        request = self.factory.get(
            '/api/products/',
            data={'min_price': 'hello'}
        )

        response = ProductListCreateAPIView.as_view()(request)

        self.assertEqual(response.status_code, 400)

    def test_stock_in_and_out(self):
        adjust_stock(
            variant_id=self.variant.id,
            operation='IN',
            quantity=10,
            reason='New shipment'
        )

        adjust_stock(
            variant_id=self.variant.id,
            operation='OUT',
            quantity=3,
            reason='Sold'
        )

        self.variant.refresh_from_db()

        self.assertEqual(self.variant.stock_quantity, 7)
        self.assertEqual(
            models.StockMovement.objects.filter(
                variant=self.variant
            ).count(),
            2
        )