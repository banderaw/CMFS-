from django.contrib import admin
from .models import (
    Category, Complaint, Comment, Assignment,
    CategoryResolver,ResolverLevel,Response
)

admin.site.register(ResolverLevel)
admin.site.register(CategoryResolver)
admin.site.register(Category)
admin.site.register(Complaint)
admin.site.register(Comment)
admin.site.register(Assignment)
admin.site.register(Response)
