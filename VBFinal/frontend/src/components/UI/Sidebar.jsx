import { useTheme } from '../../contexts/ThemeContext';

const Sidebar = ({
  isOpen,
  isCollapsed = false,
  items,
  activeItem,
  onItemClick,
  onLogout,
  onProfileClick,
  onHideSidebar,
  showEditProfile = false,
  showBottomSection = true
}) => {
  const { isDark } = useTheme();

  return (
    <>
      <aside
        className={`fixed left-0 top-20 bottom-0 w-72 ${isCollapsed ? 'lg:w-20' : 'lg:w-72'} ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-100'
          } border-r shadow-lg transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full'
          } lg:translate-x-0 z-30 overflow-y-auto flex flex-col`}
      >

        <div className="absolute top-4 right-3 lg:flex hidden">
          <button
            onClick={onHideSidebar}
            className={`p-2 rounded-lg transition-colors ${isDark
              ? 'hover:bg-gray-700/50 text-gray-400 hover:text-white'
              : 'hover:bg-gray-100 text-gray-600 hover:text-gray-900'
              }`}
            title="Hide Sidebar"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d={isCollapsed ? 'M9 5l7 7-7 7' : 'M15 19l-7-7 7-7'}
              />
            </svg>
          </button>
        </div>

        {/* Menu Items */}
        <nav className="p-5 space-y-2 flex-1">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => onItemClick(item.id)}
              title={item.name}
              className={`w-full flex items-center space-x-3.5 px-5 py-3.5 rounded-lg font-medium transition-all duration-150 ${activeItem === item.id
                ? isDark
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'bg-blue-50 text-blue-700 border-l-4 border-blue-600'
                : isDark
                  ? 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                } ${isCollapsed ? 'lg:justify-center lg:px-2 lg:space-x-0' : ''}`}
            >
              <span className="text-xl flex-shrink-0 w-5">{item.icon}</span>
              <span className={`text-sm font-semibold flex-1 text-left ${isCollapsed ? 'lg:hidden' : ''}`}>{item.name}</span>
              {item.badge && !isCollapsed && (
                <span className="bg-red-500 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 shadow-md">
                  {item.badge}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Bottom Section - Profile & Logout */}
        {showBottomSection && (
          <div className={`border-t ${isDark ? 'border-gray-700' : 'border-gray-200'} p-5 space-y-2`}>
            {/* Profile Edit Option */}
            {showEditProfile && (
              <button
                onClick={onProfileClick}
                title="Edit Profile"
                className={`w-full flex items-center space-x-3.5 px-5 py-3.5 rounded-lg font-medium transition-all duration-150 ${isDark
                  ? 'text-gray-300 hover:bg-gray-700/50 hover:text-white'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  } ${isCollapsed ? 'lg:justify-center lg:px-2 lg:space-x-0' : ''}`}
              >
                <span className="text-xl flex-shrink-0 w-5">⚙️</span>
                <span className={`text-sm font-semibold flex-1 text-left ${isCollapsed ? 'lg:hidden' : ''}`}>Edit Profile</span>
              </button>
            )}

            {/* Logout Option */}
            <button
              onClick={onLogout}
              title="Logout"
              className={`w-full flex items-center space-x-3.5 px-5 py-3.5 rounded-lg font-medium transition-all duration-150 ${isDark
                ? 'text-red-400 hover:bg-red-900/20 hover:text-red-300'
                : 'text-red-600 hover:bg-red-50 hover:text-red-800'
                } ${isCollapsed ? 'lg:justify-center lg:px-2 lg:space-x-0' : ''}`}
            >
              <span className="text-xl flex-shrink-0 w-5">🚪</span>
              <span className={`text-sm font-semibold flex-1 text-left ${isCollapsed ? 'lg:hidden' : ''}`}>Logout</span>
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-40 lg:hidden z-20 top-20 backdrop-blur-sm"
          onClick={() => {

          }}
        ></div>
      )}
    </>
  );
};

export default Sidebar;
