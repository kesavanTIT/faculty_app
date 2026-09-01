import os
import django

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'recruitment.settings')
django.setup()

from django.contrib.auth.models import User
from api.models import UserProfile

def create_admin():
    username = 'admin@college.com'
    email = 'admin@college.com'
    password = 'admin123'
    
    if not User.objects.filter(username=username).exists():
        # Create user
        user = User.objects.create_superuser(username=username, email=email, password=password)
        # Create profile mapping to Admin
        UserProfile.objects.update_or_create(user=user, defaults={'role': 'admin'})
        print("Default admin created successfully!")
    else:
        # Make sure role is set to admin even if user already existed
        user = User.objects.get(username=username)
        UserProfile.objects.update_or_create(user=user, defaults={'role': 'admin'})
        print("Admin user already exists, profile updated.")

if __name__ == '__main__':
    create_admin()
