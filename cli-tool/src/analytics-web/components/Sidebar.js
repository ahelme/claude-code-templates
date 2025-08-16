/**
 * Sidebar - Analytics dashboard sidebar
 * Simple sidebar focused only on analytics dashboard functionality
 */
class Sidebar {
  constructor(container, onNavigate) {
    this.container = container;
    this.onNavigate = onNavigate;
    this.currentPage = 'dashboard';
    this.isCollapsed = true; // Start collapsed for minimal design
    this.hoverTimeout = null;
    
    this.init();
  }

  /**
   * Initialize the sidebar
   */
  init() {
    this.render();
    this.bindEvents();
  }

  /**
   * Render the sidebar structure
   */
  render() {
    this.container.innerHTML = `
      <nav class="sidebar ${this.isCollapsed ? 'collapsed' : ''}">
        <div class="sidebar-header">
          <div class="logo">
            <div class="logo-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 3h18v18H3V3zm16 16V5H5v14h14zM7 7h10v2H7V7zm0 4h10v2H7v-2zm0 4h7v2H7v-2z"/>
              </svg>
            </div>
            <span class="logo-text">Claude Analytics</span>
          </div>
        </div>
        
        <div class="sidebar-content">
          <ul class="nav-menu">
            <li class="nav-item ${this.currentPage === 'dashboard' ? 'active' : ''}" data-page="dashboard" title="Analytics Dashboard">
              <a href="#" class="nav-link">
                <div class="nav-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z"/>
                  </svg>
                </div>
                <span class="nav-text">Dashboard</span>
              </a>
            </li>
            <li class="nav-item ${this.currentPage === 'chats' ? 'active' : ''}" data-page="chats" title="Mobile Chat Interface">
              <a href="/chats_mobile.html" class="nav-link">
                <div class="nav-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14z"/>
                  </svg>
                </div>
                <span class="nav-text">Mobile Chat</span>
              </a>
            </li>
            
            <!-- External Links Section -->
            <li class="nav-divider"></li>
            <li class="nav-item external" title="Claude Code Templates - Main Interface">
              <a href="https://www.aitmpl.com/" target="_blank" class="nav-link external-link">
                <div class="nav-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
                <span class="nav-text">Templates Hub</span>
                <div class="external-indicator">↗</div>
              </a>
            </li>
            <li class="nav-item external" title="Claude Code Documentation">
              <a href="https://docs.anthropic.com/en/docs/claude-code" target="_blank" class="nav-link external-link">
                <div class="nav-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 2 2h16c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
                  </svg>
                </div>
                <span class="nav-text">Documentation</span>
                <div class="external-indicator">↗</div>
              </a>
            </li>
          </ul>
        </div>
        
        <div class="sidebar-footer">
          <div class="connection-status" title="Connection Status">
            <div class="status-indicator">
              <span class="status-dot ${this.getConnectionStatus()}"></span>
              <span class="status-text">Live</span>
            </div>
          </div>
        </div>
      </nav>
    `;
  }

  /**
   * Bind event listeners
   */
  bindEvents() {
    const sidebar = this.container.querySelector('.sidebar');
    
    // Navigation items (only handle dashboard navigation, exclude direct links)
    const navItems = this.container.querySelectorAll('.nav-item:not(.external)');
    navItems.forEach(item => {
      const page = item.getAttribute('data-page');
      if (page === 'dashboard') {
        item.addEventListener('click', (e) => {
          e.preventDefault();
          this.navigateToPage(page);
        });
      }
      // Let other nav items (like chats) use their direct href links
    });

    // Hover to expand when collapsed
    sidebar.addEventListener('mouseenter', () => {
      if (this.isCollapsed) {
        this.expandOnHover();
      }
    });

    sidebar.addEventListener('mouseleave', () => {
      if (this.isCollapsed) {
        this.collapseOnLeave();
      }
    });
  }

  /**
   * Set active page (visual update only)
   * @param {string} page - Page identifier
   */
  setActivePage(page) {
    // Update active state visually
    const navItems = this.container.querySelectorAll('.nav-item');
    navItems.forEach(item => {
      item.classList.toggle('active', item.getAttribute('data-page') === page);
    });
    
    this.currentPage = page;
  }

  /**
   * Handle navigation click and notify parent
   * @param {string} page - Page identifier
   */
  navigateToPage(page) {
    if (page === this.currentPage) return;
    
    // Handle navigation to the specified page
    
    // Notify parent component for actual navigation
    if (this.onNavigate) {
      this.onNavigate(page);
    }
  }

  /**
   * Expand sidebar on hover
   */
  expandOnHover() {
    if (this.hoverTimeout) {
      clearTimeout(this.hoverTimeout);
    }
    
    const sidebar = this.container.querySelector('.sidebar');
    sidebar.classList.add('hover-expanded');
  }

  /**
   * Collapse sidebar when mouse leaves
   */
  collapseOnLeave() {
    this.hoverTimeout = setTimeout(() => {
      const sidebar = this.container.querySelector('.sidebar');
      sidebar.classList.remove('hover-expanded');
    }, 200); // Small delay to prevent flickering
  }

  /**
   * Get connection status class
   * @returns {string} Status class
   */
  getConnectionStatus() {
    // This would normally check actual connection status
    return 'connected';
  }

  /**
   * Update connection status
   * @param {string} status - Connection status
   */
  updateConnectionStatus(status) {
    const statusDot = this.container.querySelector('.status-dot');
    const statusText = this.container.querySelector('.status-text');
    
    if (statusDot) {
      statusDot.className = `status-dot ${status}`;
    }
    
    if (statusText) {
      statusText.textContent = status === 'connected' ? 'Live' : 'Offline';
    }
  }
  

  /**
   * Destroy sidebar
   */
  destroy() {
    // Clean up event listeners and DOM
    this.container.innerHTML = '';
  }
}

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Sidebar;
}