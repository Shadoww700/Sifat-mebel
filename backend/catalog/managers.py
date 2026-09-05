from django.db import models

class CategoryQuerySet(models.QuerySet):
    def active(self):
        return self.filter(is_active=True)

    def ordered(self):
        return self.order_by(
            'sort_order',
            'id'
        )

class CategoryManager(models.Manager):

    def get_queryset(self):
        return CategoryQuerySet(
            self.model,
            using=self._db
        )
    def active(self):
        return self.get_queryset().active()
    def ordered(self):
        return self.get_queryset().ordered()


