"""Shared public-read boundary; administrative access is decided by the view."""

from django.db.models import Q

from .models import ProductStatus


def public_product(prefix=''):
    return Q(**{
        f'{prefix}is_active': True,
        f'{prefix}brand__is_active': True,
        f'{prefix}product_type__is_active': True,
        f'{prefix}product_type__category__is_active': True,
        f'{prefix}status__in': [ProductStatus.ACTIVE, ProductStatus.OUT_OF_STOCK],
    })
