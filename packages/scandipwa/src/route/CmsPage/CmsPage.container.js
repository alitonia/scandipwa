/**
 * ScandiPWA - Progressive Web App for Magento
 *
 * Copyright © Scandiweb, Inc. All rights reserved.
 * See LICENSE for license details.
 *
 * @license OSL-3.0 (Open Software License ("OSL") v. 3.0)
 * @package scandipwa/scandipwa
 * @link https://github.com/scandipwa/scandipwa
 */

import PropTypes from 'prop-types';
import { connect } from 'react-redux';

import { CMS_PAGE } from 'Component/Header/Header.config';
import CmsPageQuery from 'Query/CmsPage.query';
import { toggleBreadcrumbs } from 'Store/Breadcrumbs/Breadcrumbs.action';
import { updateMeta } from 'Store/Meta/Meta.action';
import { changeNavigationState } from 'Store/Navigation/Navigation.action';
import { TOP_NAVIGATION_TYPE } from 'Store/Navigation/Navigation.reducer';
import { setBigOfflineNotice } from 'Store/Offline/Offline.action';
import { LocationType, MatchType } from 'Type/Router.type';
import { scrollToTop } from 'Util/Browser';
import history from 'Util/History';
import { debounce } from 'Util/Request';
import DataContainer from 'Util/Request/DataContainer';
import { getUrlParam, isHomePageUrl } from 'Util/Url';

import CmsPage from './CmsPage.component';
import { LOADING_TIME } from './CmsPage.config';

export const BreadcrumbsDispatcher = import(
    /* webpackMode: "lazy", webpackChunkName: "dispatchers" */
    'Store/Breadcrumbs/Breadcrumbs.dispatcher'
);

/** @namespace Route/CmsPage/Container/mapStateToProps */
export const mapStateToProps = (state) => ({
    isOffline: state.OfflineReducer.isOffline
});

/** @namespace Route/CmsPage/Container/mapDispatchToProps */
export const mapDispatchToProps = (dispatch) => ({
    updateBreadcrumbs: (breadcrumbs) => BreadcrumbsDispatcher.then(
        ({ default: dispatcher }) => dispatcher.updateWithCmsPage(breadcrumbs, dispatch)
    ),
    setHeaderState: (stateName) => dispatch(changeNavigationState(TOP_NAVIGATION_TYPE, stateName)),
    setBigOfflineNotice: (isBig) => dispatch(setBigOfflineNotice(isBig)),
    updateMeta: (meta) => dispatch(updateMeta(meta)),
    toggleBreadcrumbs: (isActive) => {
        BreadcrumbsDispatcher.then(
            ({ default: dispatcher }) => dispatcher.update([], dispatch)
        );
        dispatch(toggleBreadcrumbs(isActive));
    }
});

/** @namespace Route/CmsPage/Container */
export class CmsPageContainer extends DataContainer {
    static propTypes = {
        match: MatchType.isRequired,
        currentUrl: PropTypes.string.isRequired,
        setHeaderState: PropTypes.func.isRequired,
        updateBreadcrumbs: PropTypes.func.isRequired,
        setBigOfflineNotice: PropTypes.func.isRequired,
        location: LocationType.isRequired,
        toggleBreadcrumbs: PropTypes.func.isRequired,
        pageIds: PropTypes.number,
        pageIdentifiers: PropTypes.string,
        isOnlyPlaceholder: PropTypes.bool,
        isBreadcrumbsActive: PropTypes.bool
    };

    static defaultProps = {
        pageIds: -1,
        pageIdentifiers: '',
        isOnlyPlaceholder: false,
        isBreadcrumbsActive: true
    };

    state = {
        page: {},
        isLoading: true,
        isPageLoaded: false
    };

    setOfflineNoticeSize = this.setOfflineNoticeSize.bind(this);

    __construct(props) {
        const params = this.getRequestQueryParams();
        const { id, identifier } = params;

        super.__construct(props, `CmsPageContainer-${id || identifier}`);

        this.updateBreadcrumbs();
    }

    updateBreadcrumbs() {
        const {
            toggleBreadcrumbs,
            isBreadcrumbsActive
        } = this.props;

        toggleBreadcrumbs(isBreadcrumbsActive);
    }

    containerProps() {
        const { isBreadcrumbsActive } = this.props;
        const { page, isPageLoaded, isLoading } = this.state;

        return {
            isBreadcrumbsActive,
            isLoading,
            isPageLoaded,
            page
        };
    }

    componentDidMount() {
        const {
            isOffline,
            isOnlyPlaceholder
        } = this.props;

        scrollToTop();

        const { isLoading } = this.state;

        if (isOffline && isLoading) {
            debounce(this.setOfflineNoticeSize, LOADING_TIME)();
        }

        if (!isOnlyPlaceholder) {
            this.requestPage();
        }
    }

    componentDidUpdate(prevProps) {
        const {
            currentUrl,
            pageIdentifiers,
            pageIds
        } = this.props;

        const {
            currentUrl: prevCurrentUrl,
            pageIdentifiers: prevPageIdentifiers,
            pageIds: prevPageIds
        } = prevProps;

        if (
            currentUrl !== prevCurrentUrl
            || pageIds !== prevPageIds
            || pageIdentifiers !== prevPageIdentifiers
        ) {
            this.requestPage();
        }
    }

    setOfflineNoticeSize() {
        const { setBigOfflineNotice } = this.props;
        const { isLoading } = this.state;

        if (isLoading) {
            setBigOfflineNotice(true);
        } else {
            setBigOfflineNotice(false);
        }
    }

    onPageLoad({ cmsPage: page }) {
        const {
            updateMeta,
            setHeaderState,
            updateBreadcrumbs
        } = this.props;
        const { location: { pathname } } = history;
        const {
            content_heading,
            meta_title,
            title,
            meta_description,
            meta_keywords
        } = page;

        debounce(this.setOfflineNoticeSize, LOADING_TIME)();

        updateBreadcrumbs(page);
        updateMeta({
            title: meta_title || title,
            description: meta_description,
            keywords: meta_keywords,
            canonical_url: window.location.href
        });

        if (!isHomePageUrl(pathname)) {
            setHeaderState({
                name: CMS_PAGE,
                title: content_heading,
                onBackClick: () => history.goBack()
            });
        }

        this.setState({ page, isLoading: false, isPageLoaded: true });
    }

    getRequestQueryParams() {
        const {
            match,
            pageIdentifiers: identifier,
            pageIds: id
        } = this.props;
        const { location } = history;

        if (identifier) {
            return { identifier };
        }

        if (id !== -1) {
            return { id };
        }

        const urlKey = getUrlParam(match, location);

        return {
            identifier: urlKey
        };
    }

    requestPage() {
        const { isOffline } = this.props;
        const params = this.getRequestQueryParams();
        const { id, identifier } = params;

        if (!id && !identifier) {
            return;
        }

        this.setState({ isLoading: true });

        this.fetchData(
            [CmsPageQuery.getQuery(params)],
            this.onPageLoad.bind(this),
            () => this.setState({ isLoading: false }),
            isOffline
        );
    }

    render() {
        return (
            <CmsPage
              { ...this.containerProps() }
            />
        );
    }
}

export default connect(mapStateToProps, mapDispatchToProps)(CmsPageContainer);
