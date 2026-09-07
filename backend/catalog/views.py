from rest_framework import generics
from rest_framework.permissions import AllowAny, IsAuthenticated,IsAdminUser
from .permissions import (
    IsAdminOrReadonly
)


from .models import (
    Category,
    Brand,
    ProductType,

    )
from .serializers import (
    CategorySerializer,
    BrandSerializer,
    ProductTypeSerializer,

)

class CategoryListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = CategorySerializer

    def get_queryset(self):
        if self.request.method == 'GET':
            return Category.objects.active().ordered()
        return Category.objects.ordered()

    def get_permissions(self):
        if self.request.method == 'GET':
            return [AllowAny()]
        return [IsAdminUser()]


class CategoryDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = CategorySerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        if self.request.method == 'GET':
            return Category.objects.active()
        return Category.objects.all()


class BrandListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = BrandSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        if self.request.user.is_staff:
            return Brand.objects.all().order_by('id')
        return Brand.objects.filter(
            is_active=True
        ).order_by('id')


class BrandDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = BrandSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        if self.request.user.is_staff:
            return Brand.objects.all()
        return Brand.objects.filter(is_active=True)


class ProductTypeListCreateAPIView(generics.ListCreateAPIView):
    serializer_class = ProductTypeSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = ProductType.objects.select_related('category')
        if self.request.user.is_staff:
            return qs   
                
        return qs.filter(is_active=True)


class ProductTypeDetailAPIView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = ProductTypeSerializer
    permission_classes = [IsAdminOrReadonly]

    def get_queryset(self):
        qs = ProductType.objects.select_related('category')
        if self.request.user.is_staff:
            return qs   
        
        return qs.filter(is_active=True)