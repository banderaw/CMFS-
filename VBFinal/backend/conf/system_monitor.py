import time
import logging
from datetime import datetime, timedelta
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.core.cache import cache
from django.conf import settings
from django.db import connection

try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False

logger = logging.getLogger(__name__)

class SystemMonitor:
    """Enhanced system monitoring with caching and database metrics"""
    
    @staticmethod
    def get_database_stats():
        """Get database connection and query statistics"""
        try:
            with connection.cursor() as cursor:
                # Get database size (PostgreSQL specific, fallback for others)
                try:
                    cursor.execute("SELECT pg_size_pretty(pg_database_size(current_database()))")
                    db_size = cursor.fetchone()[0]
                except:
                    db_size = "Unknown"
                
                # Get active connections
                try:
                    cursor.execute("SELECT count(*) FROM pg_stat_activity WHERE state = 'active'")
                    active_connections = cursor.fetchone()[0]
                except:
                    active_connections = len(connection.queries)
                
                return {
                    'size': db_size,
                    'active_connections': active_connections,
                    'total_queries': len(connection.queries)
                }
        except Exception as e:
            logger.error(f"Database stats error: {e}")
            return {'size': 'N/A', 'active_connections': 0, 'total_queries': 0}
    
    @staticmethod
    def get_django_stats():
        """Get Django-specific statistics"""
        try:
            from complaints.models import Complaint
            from accounts.models import User
            
            # Get model counts
            total_complaints = Complaint.objects.count()
            pending_complaints = Complaint.objects.filter(status='pending').count()
            total_users = User.objects.count()
            active_users = User.objects.filter(is_active=True).count()
            
            # Get recent activity (last 24 hours)
            from django.utils import timezone
            yesterday = timezone.now() - timedelta(days=1)
            recent_complaints = Complaint.objects.filter(created_at__gte=yesterday).count()
            
            return {
                'total_complaints': total_complaints,
                'pending_complaints': pending_complaints,
                'total_users': total_users,
                'active_users': active_users,
                'recent_complaints': recent_complaints,
                'cache_stats': {
                    'backend': settings.CACHES['default']['BACKEND'].split('.')[-1],
                    'location': settings.CACHES['default'].get('LOCATION', 'default')
                }
            }
        except Exception as e:
            logger.error(f"Django stats error: {e}")
            return {
                'total_complaints': 0,
                'pending_complaints': 0,
                'total_users': 0,
                'active_users': 0,
                'recent_complaints': 0,
                'cache_stats': {'backend': 'unknown', 'location': 'unknown'}
            }
    
    @staticmethod
    def get_system_info():
        """Get real system information"""
        try:
            import django
            import sys
            import platform
            from django.db import connection
            
            # Get Django version
            django_version = django.get_version()
            
            # Get Python version
            python_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
            
            # Get OS information
            os_info = f"{platform.system()} {platform.release()}"
            
            # Get database info
            db_vendor = connection.vendor
            db_version = "Unknown"
            try:
                with connection.cursor() as cursor:
                    if db_vendor == 'postgresql':
                        cursor.execute("SELECT version()")
                        db_version = cursor.fetchone()[0].split()[1]
                    elif db_vendor == 'sqlite':
                        cursor.execute("SELECT sqlite_version()")
                        db_version = cursor.fetchone()[0]
                    elif db_vendor == 'mysql':
                        cursor.execute("SELECT VERSION()")
                        db_version = cursor.fetchone()[0]
            except:
                pass
            
            # Get server uptime
            try:
                import psutil
                boot_time = psutil.boot_time()
                uptime_seconds = time.time() - boot_time
                uptime_days = int(uptime_seconds // 86400)
                uptime_hours = int((uptime_seconds % 86400) // 3600)
                uptime_str = f"{uptime_days} days, {uptime_hours} hours"
            except:
                uptime_str = "Unknown"
            
            return {
                'django_version': django_version,
                'python_version': python_version,
                'os_info': os_info,
                'database': {
                    'vendor': db_vendor.title(),
                    'version': db_version
                },
                'uptime': uptime_str,
                'environment': settings.DEBUG and 'Development' or 'Production'
            }
        except Exception as e:
            logger.error(f"System info error: {e}")
            return {
                'django_version': 'Unknown',
                'python_version': 'Unknown', 
                'os_info': 'Unknown',
                'database': {'vendor': 'Unknown', 'version': 'Unknown'},
                'uptime': 'Unknown',
                'environment': 'Unknown'
            }

@csrf_exempt
@require_http_methods(["GET"])
def get_system_stats(request):
    """Get comprehensive system statistics with caching"""
    cache_key = 'system_stats'
    cache_timeout = 60  # Increased from 30 to 60 seconds cache
    
    # Try to get from cache first
    cached_stats = cache.get(cache_key)
    if cached_stats and not request.GET.get('force_refresh'):
        cached_stats['cached'] = True
        return JsonResponse(cached_stats)
    
    try:
        monitor = SystemMonitor()
        
        if not PSUTIL_AVAILABLE:
            # Enhanced mock data
            stats = {
                'system': {
                    'cpu': 45.2,
                    'memory': 67.8,
                    'disk': 23.1,
                    'network_sent': 125.4,
                    'network_recv': 89.7,
                    'uptime_hours': 72.5,
                    'process_count': 156,
                    'health': 'healthy'
                },
                'database': monitor.get_database_stats(),
                'django': monitor.get_django_stats(),
                'system_info': monitor.get_system_info(),
                'timestamp': time.time(),
                'mock': True,
                'cached': False
            }
        else:
            # Real system stats
            cpu_percent = psutil.cpu_percent(interval=0.1)
            memory = psutil.virtual_memory()
            disk = psutil.disk_usage('/')
            network = psutil.net_io_counters()
            boot_time = psutil.boot_time()
            uptime = time.time() - boot_time
            
            stats = {
                'system': {
                    'cpu': round(cpu_percent, 1),
                    'memory': round(memory.percent, 1),
                    'disk': round((disk.used / disk.total) * 100, 1),
                    'network_sent': round(network.bytes_sent / (1024*1024), 2),
                    'network_recv': round(network.bytes_recv / (1024*1024), 2),
                    'uptime_hours': round(uptime / 3600, 1),
                    'process_count': len(psutil.pids()),
                    'load_avg': list(psutil.getloadavg()) if hasattr(psutil, 'getloadavg') else [0, 0, 0]
                },
                'database': monitor.get_database_stats(),
                'django': monitor.get_django_stats(),
                'system_info': monitor.get_system_info(),
                'timestamp': time.time(),
                'mock': False,
                'cached': False
            }
        
        # Cache the results
        cache.set(cache_key, stats, cache_timeout)
        
        return JsonResponse(stats)
        
    except Exception as e:
        logger.error(f"System stats error: {e}")
        return JsonResponse({
            'error': str(e),
            'timestamp': time.time()
        }, status=500)

@csrf_exempt
@require_http_methods(["GET"])
def get_system_alerts(request):
    """Get system alerts and warnings"""
    try:
        alerts = []
        
        if PSUTIL_AVAILABLE:
            # CPU Alert
            cpu = psutil.cpu_percent(interval=0.1)
            if cpu > 90:
                alerts.append({
                    'type': 'critical',
                    'category': 'cpu',
                    'message': f'High CPU usage: {cpu}%',
                    'threshold': 90
                })
            elif cpu > 70:
                alerts.append({
                    'type': 'warning',
                    'category': 'cpu',
                    'message': f'Elevated CPU usage: {cpu}%',
                    'threshold': 70
                })
            
            # Memory Alert
            memory = psutil.virtual_memory().percent
            if memory > 90:
                alerts.append({
                    'type': 'critical',
                    'category': 'memory',
                    'message': f'High memory usage: {memory}%',
                    'threshold': 90
                })
            elif memory > 80:
                alerts.append({
                    'type': 'warning',
                    'category': 'memory',
                    'message': f'Elevated memory usage: {memory}%',
                    'threshold': 80
                })
            
            # Disk Alert
            disk = psutil.disk_usage('/')
            disk_percent = (disk.used / disk.total) * 100
            if disk_percent > 95:
                alerts.append({
                    'type': 'critical',
                    'category': 'disk',
                    'message': f'Disk space critical: {disk_percent:.1f}%',
                    'threshold': 95
                })
            elif disk_percent > 85:
                alerts.append({
                    'type': 'warning',
                    'category': 'disk',
                    'message': f'Disk space low: {disk_percent:.1f}%',
                    'threshold': 85
                })
        
        # Django-specific alerts
        try:
            from complaints.models import Complaint
            pending_count = Complaint.objects.filter(status='pending').count()
            if pending_count > 50:
                alerts.append({
                    'type': 'warning',
                    'category': 'complaints',
                    'message': f'High number of pending complaints: {pending_count}',
                    'threshold': 50
                })
        except:
            pass
        
        return JsonResponse({
            'alerts': alerts,
            'count': len(alerts),
            'timestamp': time.time()
        })
        
    except Exception as e:
        logger.error(f"System alerts error: {e}")
        return JsonResponse({'error': str(e)}, status=500)
